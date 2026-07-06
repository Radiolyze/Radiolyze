import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _build_database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./app.db")


DATABASE_URL = _build_database_url()

connect_args: dict[str, object] = {}
engine_kwargs: dict[str, object] = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # SQLite (used for tests/dev) doesn't support pool sizing or pre-ping;
    # real deployments share the DB with RQ workers, so the default pool of
    # 5 connections is exhausted quickly without tuning.
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
    }


engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass
