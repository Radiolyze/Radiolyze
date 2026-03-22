from __future__ import annotations

from collections.abc import Iterator

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

    auth_required = os.getenv("AUTH_REQUIRED", "false").lower() == "true"

    if not credentials:
        if auth_required:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
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
