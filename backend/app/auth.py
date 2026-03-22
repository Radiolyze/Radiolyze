from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

_DEV_SECRET = "medgemma-dev-secret-change-in-production"

SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEV_SECRET)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
