from __future__ import annotations

import asyncio
import contextlib
import os

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .api import annotations, audit, auth, inference, monitoring, prompts, qa, reports, templates, training, ws
from .db import Base, engine
from .ws_events import run_ws_bridge
from .ws_manager import manager

app = FastAPI(title="Orchestrator API", version="0.1.0")

cors_origins = os.getenv("CORS_ORIGINS", "*")
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
def health() -> dict[str, str]:
    return {"status": "ok"}
