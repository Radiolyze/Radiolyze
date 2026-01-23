from __future__ import annotations

import asyncio
import contextlib
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import annotations, audit, inference, monitoring, prompts, reports, ws
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

app.include_router(annotations.router)
app.include_router(reports.router)
app.include_router(inference.router)
app.include_router(prompts.router)
app.include_router(audit.router)
app.include_router(monitoring.router)
app.include_router(ws.router)


@app.on_event("startup")
async def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
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
