"""Auth schemas."""

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class MFARequest(BaseModel):
    session_token: str
    code: str  # 6-digit TOTP


class SSOCallbackRequest(BaseModel):
    code: str
    state: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str
