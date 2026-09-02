from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .auth import AUTH_COOKIE_NAME
from .db import SessionLocal

_bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    auth_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    """Extract and validate the JWT, return the User object.

    The browser frontend authenticates via the HttpOnly ``radiolyze_token``
    cookie (see issue #100); the ``Authorization: Bearer`` header remains
    supported for non-browser API clients. The cookie takes precedence when
    both are present.

    If AUTH_REQUIRED is not set to 'true', returns None to allow
    unauthenticated access during development.
    """
    import os

    from .auth import decode_access_token
    from .models import User

    auth_required = os.getenv("AUTH_REQUIRED", "true").lower() == "true"

    token = auth_cookie or (credentials.credentials if credentials else None)

    if not token:
        if auth_required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )
        return None

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub", "")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return user


def require_role(*roles: str) -> Any:
    """Return a FastAPI dependency that enforces role-based access control.

    When AUTH_REQUIRED=false (development), the check is skipped entirely.
    In production (or when AUTH_REQUIRED=true) the current user must have
    one of the specified roles, otherwise a 403 is raised.

    The return value is already a ``Depends`` marker, so call sites use it
    directly as the default rather than wrapping it again::

        @router.delete("/api/v1/qa/rules/{rule_id}")
        def delete_qa_rule(
            rule_id: str,
            _: None = require_role("admin"),
            db: Session = Depends(get_db),
        ) -> None:
            ...

    Declared as ``Any`` for the same reason ``fastapi.Depends`` itself is:
    the marker stands in for whatever the dependency resolves to, so the
    parameter it is assigned to keeps its own annotation (``None`` above).
    Annotating it ``Callable`` -- which it is not; ``params.Depends`` has no
    ``__call__`` -- made every one of those defaults a type error.
    """
    import os

    def _check(user=Depends(get_current_user)) -> None:
        auth_required = os.getenv("AUTH_REQUIRED", "true").lower() == "true"
        if not auth_required or user is None:
            return
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' not permitted. Required: {list(roles)}",
            )

    return Depends(_check)


# Convenience aliases
require_admin = require_role("admin")
require_radiologist_or_admin = require_role("radiologist", "admin")
