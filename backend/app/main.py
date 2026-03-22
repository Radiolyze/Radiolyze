from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import uuid

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .api import annotations, audit, auth, inference, monitoring, prompts, qa, reports, templates, training, ws
from .db import Base, engine
from .ws_events import run_ws_bridge
from .ws_manager import manager

# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Orchestrator API", version="0.1.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
origin_list = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
if not origin_list:
    origin_list = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request-ID Middleware for distributed tracing
# ---------------------------------------------------------------------------
import contextvars

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next) -> Response:
    rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request_id_ctx.set(rid)
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    return response


# ---------------------------------------------------------------------------
# Rate Limiting Middleware (simple in-memory, use Redis in production)
# ---------------------------------------------------------------------------
import time
from collections import defaultdict

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_DEFAULT = int(os.getenv("RATE_LIMIT_DEFAULT", "100"))

# Stricter limits for specific paths
_PATH_LIMITS: dict[str, int] = {
    "/api/v1/auth/login": 5,
    "/api/v1/inference/queue": 10,
    "/api/v1/inference/localize": 10,
    "/api/v1/reports/asr-transcript": 20,
}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next) -> Response:
    if request.url.path.startswith("/api/v1/health") or request.url.path.startswith("/api/v1/ws"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    key = f"{client_ip}:{path}"

    limit = _PATH_LIMITS.get(path, RATE_LIMIT_DEFAULT)
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Clean old entries and check
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if t > window_start]

    if len(_rate_limit_store[key]) >= limit:
        return Response(
            content='{"detail":"Rate limit exceeded"}',
            status_code=429,
            media_type="application/json",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    _rate_limit_store[key].append(now)
    return await call_next(request)

app.include_router(qa.router)
app.include_router(templates.router)
app.include_router(auth.router)
app.include_router(annotations.router)
app.include_router(training.router)
app.include_router(reports.router)
app.include_router(inference.router)
app.include_router(prompts.router)
app.include_router(audit.router)
app.include_router(monitoring.router)
app.include_router(ws.router)


@app.on_event("startup")
async def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    # Seed default admin user if none exists
    from .db import SessionLocal
    from .models import User
    from .auth import hash_password
    from .mock_logic import utc_now
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                password_hash=hash_password("admin"),
                role="admin",
                is_active=True,
                created_at=utc_now(),
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()
    app.state.ws_bridge_task = asyncio.create_task(run_ws_bridge(manager))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "ws_bridge_task", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    """Comprehensive health check for all services."""
    from typing import Any
    import httpx

    from .db import SessionLocal
    from .queue import get_redis

    services: dict[str, dict[str, Any]] = {}

    # Database
    try:
        db = SessionLocal()
        db.execute(db.bind.dialect.do_ping(db.bind) if hasattr(db.bind.dialect, "do_ping") else None)  # type: ignore[arg-type]
        db.close()
        services["database"] = {"status": "ok"}
    except Exception as exc:
        try:
            db = SessionLocal()
            from sqlalchemy import text
            db.execute(text("SELECT 1"))
            db.close()
            services["database"] = {"status": "ok"}
        except Exception as exc2:
            services["database"] = {"status": "error", "detail": str(exc2)}

    # Redis
    try:
        r = get_redis()
        r.ping()
        services["redis"] = {"status": "ok"}
    except Exception as exc:
        services["redis"] = {"status": "error", "detail": str(exc)}

    # vLLM
    vllm_url = os.getenv("VLLM_BASE_URL", "")
    if vllm_url:
        try:
            resp = httpx.get(f"{vllm_url}/health", timeout=5)
            services["vllm"] = {"status": "ok" if resp.status_code == 200 else "degraded"}
        except Exception as exc:
            services["vllm"] = {"status": "error", "detail": str(exc)}
    else:
        services["vllm"] = {"status": "disabled"}

    # MedASR
    medasr_url = os.getenv("MEDASR_BASE_URL", "")
    if medasr_url:
        try:
            resp = httpx.get(f"{medasr_url}/health", timeout=5)
            services["medasr"] = {"status": "ok" if resp.status_code == 200 else "degraded"}
        except Exception as exc:
            services["medasr"] = {"status": "error", "detail": str(exc)}
    else:
        services["medasr"] = {"status": "disabled"}

    # Orthanc
    orthanc_url = os.getenv("DICOM_WEB_BASE_URL", "")
    if orthanc_url:
        try:
            base = orthanc_url.replace("/dicom-web", "")
            resp = httpx.get(f"{base}/system", timeout=5)
            services["orthanc"] = {"status": "ok" if resp.status_code == 200 else "degraded"}
        except Exception as exc:
            services["orthanc"] = {"status": "error", "detail": str(exc)}
    else:
        services["orthanc"] = {"status": "disabled"}

    overall = "ok"
    for svc in services.values():
        if svc["status"] == "error":
            overall = "degraded"
            break

    return {"status": overall, "services": services}
