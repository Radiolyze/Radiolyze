from __future__ import annotations

import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import jwt

_DEV_SECRET = "medgemma-dev-secret-change-in-production"

SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEV_SECRET)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

_logger = logging.getLogger(__name__)


def validate_jwt_config() -> None:
    """Validate JWT configuration at startup.

    Raises RuntimeError in production/staging if the secret is insecure.
    Logs a warning in development mode.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    is_production = env in ("production", "staging")

    if SECRET_KEY == _DEV_SECRET:
        if is_production:
            raise RuntimeError(
                "FATAL: JWT_SECRET_KEY is set to the default development value. "
                "Set a secure JWT_SECRET_KEY (>= 32 chars) for production."
            )
        _logger.warning(
            "JWT_SECRET_KEY is using the default development value. "
            "Set a secure secret before deploying to production."
        )
        return

    if len(SECRET_KEY) < 32:
        if is_production:
            raise RuntimeError(
                f"FATAL: JWT_SECRET_KEY is too short ({len(SECRET_KEY)} chars). "
                "Use at least 32 characters for production."
            )
        _logger.warning(
            "JWT_SECRET_KEY is shorter than 32 characters. "
            "Consider using a longer secret for better security."
        )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
