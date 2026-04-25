import asyncio
import contextlib
import contextvars
import logging
import os
import uuid
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .api import annotations as annotations_api
from .api import (
    audit,
    auth,
    guidelines,
    inference,
    monitoring,
    prompts,
    qa,
    reports,
    templates,
    training,
    ws,
)
from .db import Base, engine
from .rate_limiter import RateLimiter
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


# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
    csp = os.getenv(
        "CSP_POLICY",
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    )
    response.headers["Content-Security-Policy"] = csp
    if os.getenv("ENABLE_HSTS", "").lower() in {"1", "true", "yes"}:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


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
# Rate Limiting Middleware (Redis-backed with in-memory fallback)
# ---------------------------------------------------------------------------
RATE_LIMIT_DEFAULT = int(os.getenv("RATE_LIMIT_DEFAULT", "100"))
RATE_LIMIT_CLEANUP_INTERVAL = 300  # purge stale keys every 5 minutes

# Stricter limits for specific paths
_PATH_LIMITS: dict[str, int] = {
    "/api/v1/auth/login": 5,
    "/api/v1/inference/queue": 10,
    "/api/v1/inference/localize": 10,
    "/api/v1/reports/asr-transcript": 20,
}

_rate_limiter = RateLimiter(window_seconds=60)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next) -> Response:
    global _rate_limit_last_cleanup

    if request.url.path.startswith("/api/v1/health") or request.url.path.startswith("/api/v1/ws"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    key = f"{client_ip}:{path}"

    limit = _PATH_LIMITS.get(path, RATE_LIMIT_DEFAULT)
    allowed, remaining, retry_after = _rate_limiter.check(key, limit)

    if not allowed:
        return Response(
            content='{"detail":"Rate limit exceeded"}',
            status_code=429,
            media_type="application/json",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response


app.include_router(qa.router)
app.include_router(templates.router)
app.include_router(auth.router)
app.include_router(annotations_api.router)
app.include_router(training.router)
app.include_router(reports.router)
app.include_router(inference.router)
app.include_router(prompts.router)
app.include_router(audit.router)
app.include_router(monitoring.router)
app.include_router(guidelines.router)
app.include_router(ws.router)


def _get_drift_schedule_hours() -> int:
    try:
        return max(0, int(os.getenv("DRIFT_SCHEDULE_HOURS", "24")))
    except ValueError:
        return 24


def _run_scheduled_drift() -> None:
    """Periodic drift snapshot – runs in APScheduler background thread."""
    from .api.monitoring import compute_drift_snapshot
    from .db import SessionLocal

    window_days = int(os.getenv("DRIFT_WINDOW_DAYS", "7"))
    baseline_env = os.getenv("DRIFT_BASELINE_DAYS")
    baseline_days = int(baseline_env) if baseline_env else None

    db = SessionLocal()
    try:
        compute_drift_snapshot(db, window_days=window_days,
                               baseline_days=baseline_days, persist=True)
        logger.info("Scheduled drift snapshot created (window=%dd)", window_days)
    except Exception:
        logger.exception("Scheduled drift snapshot failed")
    finally:
        db.close()


@app.on_event("startup")
async def on_startup() -> None:
    # Validate JWT configuration before anything else
    from .auth import validate_jwt_config

    validate_jwt_config()

    Base.metadata.create_all(bind=engine)
    # Seed default admin user if none exists
    from .auth import hash_password, verify_password
    from .db import SessionLocal
    from .mock_logic import utc_now
    from .models import User

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
            if admin_password == "admin":
                logger.warning(
                    "Using default admin password. Set ADMIN_PASSWORD env var for production."
                )
            admin = User(
                username=os.environ.get("ADMIN_USERNAME", "admin"),
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
                created_at=utc_now(),
            )
            db.add(admin)
            db.commit()
            logger.warning(
                "Default admin user created with default password. "
                "Change the admin password before deploying to production."
            )
        else:
            # Warn if default admin still has the default password
            admin = db.query(User).filter(User.username == "admin").first()
            if admin and verify_password("admin", admin.password_hash):
                logger.warning(
                    "Admin user still has the default password. "
                    "Change it before deploying to production."
                )
    finally:
        db.close()
    app.state.ws_bridge_task = asyncio.create_task(run_ws_bridge(manager))

    schedule_hours = _get_drift_schedule_hours()
    if schedule_hours > 0:
        scheduler = BackgroundScheduler(daemon=True)
        scheduler.add_job(
            _run_scheduled_drift,
            trigger="interval",
            hours=schedule_hours,
            id="drift_monitoring",
            max_instances=1,
            coalesce=True,
        )
        scheduler.start()
        app.state.drift_scheduler = scheduler
        logger.info("Drift scheduler started: interval=%dh", schedule_hours)
    else:
        logger.info("Drift scheduler disabled (DRIFT_SCHEDULE_HOURS=0)")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "ws_bridge_task", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    scheduler = getattr(app.state, "drift_scheduler", None)
    if scheduler is not None:
        scheduler.shutdown(wait=False)


@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    """Comprehensive health check for all services."""
    import httpx
    from sqlalchemy import text

    from .db import SessionLocal
    from .queue import get_redis

    services: dict[str, dict[str, Any]] = {}

    # Database
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            services["database"] = {"status": "ok"}
        finally:
            db.close()
    except Exception as exc:
        services["database"] = {"status": "error", "detail": str(exc)}

    # Redis
    try:
        r = get_redis()
        r.ping()
        services["redis"] = {"status": "ok"}
    except Exception as exc:
        services["redis"] = {"status": "error", "detail": str(exc)}

    # External service checks
    def _check_url(name: str, url: str, path: str) -> None:
        if not url:
            services[name] = {"status": "disabled"}
            return
        try:
            resp = httpx.get(f"{url}{path}", timeout=5)
            services[name] = {"status": "ok" if resp.status_code == 200 else "degraded"}
        except Exception as exc:
            services[name] = {"status": "error", "detail": str(exc)}

    _check_url("vllm", os.getenv("VLLM_BASE_URL", ""), "/health")
    _check_url("medasr", os.getenv("MEDASR_BASE_URL", ""), "/health")

    # OpenAI-compatible ASR (e.g. hwdsl2/whisper-server: /docs for liveness)
    asr_provider = os.getenv("ASR_PROVIDER", "medasr").strip().lower()
    if asr_provider in {"openai", "openai_audio", "whisper", "whisper_http"}:
        openai_asr_base = (os.getenv("ASR_OPENAI_BASE_URL") or "").rstrip("/")
        if openai_asr_base:
            _check_url("asr_openai", openai_asr_base, "/docs")

    orthanc_url = os.getenv("DICOM_WEB_BASE_URL", "")
    _check_url("orthanc", orthanc_url.replace("/dicom-web", "") if orthanc_url else "", "/system")

    overall = "ok"
    for svc in services.values():
        if svc["status"] == "error":
            overall = "degraded"
            break

    return {"status": overall, "services": services}
