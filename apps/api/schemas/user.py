"""User schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from core.rbac import Role


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    title: str | None = None
    phone: str | None = None
    role: Role = Role.PRE_SALES
    password: str | None = None  # None = SSO-only account


class UserUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    preferred_language: str | None = None
    preferred_timezone: str | None = None
    notification_email: bool | None = None
    notification_slack: bool | None = None


class UserRoleUpdate(BaseModel):
    role: Role


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    title: str | None
    phone: str | None
    role: str
    is_active: bool
    mfa_enabled: bool
    avatar_url: str | None
    preferred_language: str
    preferred_timezone: str
    created_at: datetime
    last_active_at: datetime | None


class UserListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: str
    is_active: bool
    last_active_at: datetime | None
