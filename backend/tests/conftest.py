"""Shared test fixtures for backend tests."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for tests
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["AUTH_REQUIRED"] = "false"
os.environ["VLLM_ENABLED"] = "false"
os.environ["VLLM_FALLBACK_TO_MOCK"] = "true"
os.environ["MEDASR_FALLBACK_TO_MOCK"] = "true"

from app.db import Base  # noqa: E402
from app.deps import get_db  # noqa: E402
from app.main import app  # noqa: E402


engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test and drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture()
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture()
def db():
    """Direct DB session for test setup."""
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
