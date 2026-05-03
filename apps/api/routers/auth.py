"""Authentication router."""

import base64
import binascii
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.rbac import Role
from core.database import get_db
from core.security import create_access_token, get_current_user, hash_password, verify_password
from models.user import User
from schemas.auth import LoginRequest, MFARequest, SSOCallbackRequest, SignupRequest, TokenResponse
from schemas.user import UserResponse, UserUpdate
from services.audit import log_action
from services.cache import get_redis

router = APIRouter(prefix="/auth", tags=["auth"])

_KEYCLOAK_TIMEOUT = httpx.Timeout(10.0)


def _frontend_base_url() -> str:
    origin = settings.allowed_origins[0] if settings.allowed_origins else "http://localhost:3000"
    return origin.rstrip("/")


def _make_state(redirect_path: str) -> str:
    nonce = secrets.token_urlsafe(16)
    payload = {"redirect_path": redirect_path, "nonce": nonce}
    raw = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def _read_state(state: str | None) -> dict:
    if not state:
        return {}
    try:
        padding = "=" * (-len(state) % 4)
        decoded = base64.urlsafe_b64decode((state + padding).encode("utf-8")).decode("utf-8")
        data = json.loads(decoded)
        return data if isinstance(data, dict) else {}
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return {}


def _get_client_ip(request: Request) -> str | None:
    """Extract real client IP, respecting reverse-proxy X-Forwarded-For."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def _exchange_keycloak_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=_KEYCLOAK_TIMEOUT) as client:
        resp = await client.post(
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.keycloak_client_id,
                "client_secret": settings.keycloak_client_secret,
                "code": code,
                "redirect_uri": f"{settings.api_base_url}/auth/sso-callback",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO authentication failed")
    return resp.json()


async def _resolve_or_create_sso_user(db: AsyncSession, keycloak_access_token: str) -> User:
    userinfo_resp = await _get_keycloak_userinfo(keycloak_access_token)
    email = userinfo_resp.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email in SSO token")

    # Check for existing active user
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()
    if user:
        return user

    # Reject deactivated accounts — do not silently re-enable via SSO
    inactive = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if inactive is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    user = User(
        email=email,
        name=userinfo_resp.get("name", email.split("@")[0]),
        role=Role.PRE_SALES.value,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse | JSONResponse:
    """Email + password login (break-glass admins only)."""
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.mfa_enabled:
        # Return a short-lived session token for the MFA step — use JSONResponse, not HTTPException
        session_token = create_access_token(
            {"sub": str(user.id), "mfa_required": True},
            expires_delta=timedelta(minutes=5),
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"mfa_required": True, "session_token": session_token},
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    await log_action(db, user.id, "login", "user", str(user.id), ip_address=_get_client_ip(request))
    return TokenResponse(access_token=token, expires_in=settings.jwt_expiry_minutes * 60)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name.strip(),
        role=Role.PRE_SALES.value,
        hashed_password=hash_password(body.password),
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await log_action(
        db,
        user.id,
        "signup",
        "user",
        str(user.id),
        ip_address=_get_client_ip(request),
    )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, expires_in=settings.jwt_expiry_minutes * 60)


@router.get("/sso-start")
async def sso_start(
    redirect_path: str = Query("/dashboard"),
) -> RedirectResponse:
    state = _make_state(redirect_path)
    query = urlencode({
        "response_type": "code",
        "client_id": settings.keycloak_client_id,
        "scope": "openid profile email",
        "redirect_uri": f"{settings.api_base_url}/auth/sso-callback",
        "state": state,
    })
    authorize_url = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/auth?{query}"
    return RedirectResponse(url=authorize_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.post("/sso-callback", response_model=TokenResponse)
async def sso_callback(
    body: SSOCallbackRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Handle Keycloak SSO callback (API client flow)."""
    kc_token = await _exchange_keycloak_code(body.code)
    user = await _resolve_or_create_sso_user(db, kc_token["access_token"])
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, expires_in=settings.jwt_expiry_minutes * 60)


@router.get("/sso-callback")
async def sso_callback_redirect(
    code: str,
    state: str | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> RedirectResponse:
    redirect_path = _read_state(state).get("redirect_path", "/dashboard")
    if not isinstance(redirect_path, str) or not redirect_path.startswith("/"):
        redirect_path = "/dashboard"

    frontend_login = f"{_frontend_base_url()}/login"
    try:
        kc_token = await _exchange_keycloak_code(code)
        user = await _resolve_or_create_sso_user(db, kc_token["access_token"])
        token = create_access_token({"sub": str(user.id), "role": user.role})

        # Store token in Redis with a 30-second one-time exchange code to avoid
        # putting the full JWT in the URL (logs, Referer headers, browser history).
        redis = await get_redis()
        if redis:
            exchange_code = secrets.token_urlsafe(32)
            await redis.setex(f"sso:exchange:{exchange_code}", 30, token)
            return RedirectResponse(
                url=f"{frontend_login}?sso_code={exchange_code}&redirect={quote(redirect_path, safe='/')}",
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            )

        # Fallback (Redis unavailable): use URL fragment — not sent in server logs or Referer
        return RedirectResponse(
            url=f"{frontend_login}?redirect={quote(redirect_path, safe='/')}#token={token}",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )
    except (HTTPException, httpx.HTTPError, KeyError, ValueError):
        return RedirectResponse(
            url=f"{frontend_login}?sso_error=1",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )


@router.post("/mfa/verify", response_model=TokenResponse)
async def verify_mfa(
    body: MFARequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Verify TOTP code and issue full access token."""
    import pyotp
    from core.security import decode_token

    payload = decode_token(body.session_token)
    if not payload.get("mfa_required"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not an MFA session token")

    user_id = payload.get("sub")
    # Enforce is_active check — deactivated users must not complete MFA
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Replay protection: reject codes already used within the validity window
    redis = await get_redis()
    used_key = f"mfa:used:{user.id}:{body.code}"
    if redis:
        if await redis.get(used_key):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="MFA code already used. Wait for the next code.",
            )

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    # Mark code as used for 90 seconds (covers the valid_window=1 range)
    if redis:
        await redis.setex(used_key, 90, "1")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, expires_in=settings.jwt_expiry_minutes * 60)


@router.post("/sso/exchange", response_model=TokenResponse)
async def sso_exchange_code(
    code: str = Body(..., embed=True),
) -> TokenResponse:
    """Consume a one-time SSO exchange code (stored in Redis) and return a JWT."""
    redis = await get_redis()
    if not redis:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Token exchange unavailable (Redis offline)",
        )
    raw = await redis.get(f"sso:exchange:{code}")
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired exchange code",
        )
    await redis.delete(f"sso:exchange:{code}")
    token = raw.decode() if isinstance(raw, bytes) else raw
    try:
        payload_b64 = token.split(".")[1]
        padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode((payload_b64 + padding).encode()))
        expires_in = max(0, int(payload.get("exp", 0) - datetime.now(UTC).timestamp()))
    except Exception:
        expires_in = settings.jwt_expiry_minutes * 60
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    current_user: Annotated[User, Depends(get_current_user)],
) -> TokenResponse:
    """Issue a fresh JWT for an authenticated (not yet expired) session."""
    token = create_access_token({"sub": str(current_user.id), "role": current_user.role})
    return TokenResponse(access_token=token, expires_in=settings.jwt_expiry_minutes * 60)


@router.post("/logout")
async def logout() -> dict[str, str]:
    """Logout (client should discard the token)."""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update the currently authenticated user's profile."""
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, key, value)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


async def _get_keycloak_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=_KEYCLOAK_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return resp.json() if resp.status_code == 200 else {}
