from __future__ import annotations

from collections.abc import Callable, Iterator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

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
    db: Session = Depends(get_db),
):
    """Extract and validate JWT token, return the User object.

    If AUTH_REQUIRED is not set to 'true', returns None to allow
    unauthenticated access during development.
    """
    import os

    from .auth import decode_access_token
    from .models import User

    auth_required = os.getenv("AUTH_REQUIRED", "true").lower() == "true"

    if not credentials:
        if auth_required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub", "")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return user


def require_role(*roles: str) -> Callable:
    """Return a FastAPI dependency that enforces role-based access control.

    When AUTH_REQUIRED=false (development), the check is skipped entirely.
    In production (or when AUTH_REQUIRED=true) the current user must have
    one of the specified roles, otherwise a 403 is raised.

    Usage::

        @router.delete("/api/v1/qa/rules/{rule_id}")
        def delete_qa_rule(
            rule_id: str,
            _: None = Depends(require_role("admin")),
            db: Session = Depends(get_db),
        ) -> None:
            ...
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
