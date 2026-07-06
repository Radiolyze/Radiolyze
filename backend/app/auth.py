from __future__ import annotations

import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from fastapi import Response
from jose import jwt

_DEV_SECRET = "medgemma-dev-secret-change-in-production"

SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEV_SECRET)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

# Name of the HttpOnly cookie that carries the JWT to the browser. The token is
# no longer handed to frontend JS (see issue #100) - it is only ever readable
# by the browser's cookie jar, not by page scripts, which closes off XSS
# token exfiltration.
AUTH_COOKIE_NAME = "radiolyze_token"

_logger = logging.getLogger(__name__)


def is_production_env() -> bool:
    """True when running in a production/staging environment.

    Controlled by the ``ENVIRONMENT`` env var (defaults to ``development``).
    """
    return os.getenv("ENVIRONMENT", "development").lower() in ("production", "staging")


def validate_jwt_config() -> None:
    """Validate JWT configuration at startup.

    Raises RuntimeError in production/staging if the secret is insecure.
    Logs a warning in development mode.
    """
    is_production = is_production_env()

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


def _cookie_is_secure() -> bool:
    """Whether the auth cookie should carry the ``Secure`` attribute.

    Always on in production/staging. Overridable via ``COOKIE_SECURE`` so a
    developer can exercise the production cookie behavior locally over HTTPS.
    """
    override = os.getenv("COOKIE_SECURE")
    if override is not None:
        return override.lower() == "true"
    return is_production_env()


def set_auth_cookie(response: Response, token: str) -> None:
    """Attach the JWT to the response as an HttpOnly, SameSite=Strict cookie.

    SameSite=Strict means the cookie is never sent on cross-site requests
    (not even top-level navigations), which is the primary CSRF defense here -
    a malicious site cannot get the browser to attach it to a forged request.
    """
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=_cookie_is_secure(),
        samesite="strict",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_cookie_is_secure(),
        samesite="strict",
    )
