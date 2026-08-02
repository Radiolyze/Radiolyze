from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import (
    clear_auth_cookie,
    create_access_token,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from ..deps import get_current_user, get_db
from ..models import User
from ..utils.time import IsoDateTime, utc_now

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    """The JWT itself is never returned in the body - it is set as an
    HttpOnly cookie (see ``set_auth_cookie``) so page JS can never read or
    exfiltrate it. This only carries display data for the frontend."""

    user_id: str
    username: str
    role: str


class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    is_active: bool
    created_at: IsoDateTime


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str = "radiologist"


@router.post("/api/v1/auth/login", response_model=LoginResponse)
def login(
    payload: LoginRequest, response: Response, db: Session = Depends(get_db)
) -> LoginResponse:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role})
    set_auth_cookie(response, token)
    return LoginResponse(user_id=user.id, username=user.username, role=user.role)


@router.post("/api/v1/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    clear_auth_cookie(response)
    return {"success": True}


@router.get("/api/v1/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )


@router.post("/api/v1/auth/users", response_model=UserResponse)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    now = utc_now()
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        created_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )
