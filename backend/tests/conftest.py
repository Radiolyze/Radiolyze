"""Shared test fixtures for backend tests."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

# Use shared named in-memory SQLite so all connections see the same DB
os.environ["DATABASE_URL"] = "sqlite:///file:testdb?mode=memory&cache=shared&uri=true"
os.environ["AUTH_REQUIRED"] = "false"
os.environ["VLLM_ENABLED"] = "false"
os.environ["VLLM_FALLBACK_TO_MOCK"] = "true"
os.environ["MEDASR_FALLBACK_TO_MOCK"] = "true"
os.environ["ENVIRONMENT"] = "development"

from app.db import Base, engine  # noqa: E402
from app.deps import get_db  # noqa: E402
from app.main import app  # noqa: E402

# Re-use the app's engine so tables are shared between app and tests
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


@pytest.fixture()
def seed_admin(db):
    """Create a default admin user and return its ID."""
    from app.auth import hash_password
    from app.models import User
    from app.mock_logic import utc_now

    admin = User(
        id="admin-001",
        username="testadmin",
        password_hash=hash_password("adminpass"),
        role="admin",
        is_active=True,
        created_at=utc_now(),
    )
    db.add(admin)
    db.commit()
    return admin.id


@pytest.fixture()
def seed_radiologist(db):
    """Create a radiologist user and return its ID."""
    from app.auth import hash_password
    from app.models import User
    from app.mock_logic import utc_now

    user = User(
        id="radio-001",
        username="testradiologist",
        password_hash=hash_password("radiopass"),
        role="radiologist",
        is_active=True,
        created_at=utc_now(),
    )
    db.add(user)
    db.commit()
    return user.id


@pytest.fixture()
def sample_report(client):
    """Create and return a sample report via the API."""
    resp = client.post("/api/v1/reports/create", json={
        "study_id": "study-001",
        "patient_id": "patient-001",
        "findings_text": "Normal chest x-ray.",
        "impression_text": "",
    })
    assert resp.status_code == 200
    return resp.json()
