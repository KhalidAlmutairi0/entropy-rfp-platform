"""Entropy RFP Intelligence Platform — FastAPI application entry point."""

import structlog
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import pydantic
import fastapi.encoders as _enc
import fastapi.routing as _routing

# ── Patch jsonable_encoder to always serialize Pydantic models with by_alias=True
# so all response schemas that use alias_generator emit camelCase for the frontend.
_orig_jsonable_encoder = _enc.jsonable_encoder

def _camel_jsonable_encoder(obj, *args, **kwargs):  # type: ignore[override]
    if isinstance(obj, pydantic.BaseModel):
        kwargs.setdefault("by_alias", True)
    return _orig_jsonable_encoder(obj, *args, **kwargs)

_enc.jsonable_encoder = _camel_jsonable_encoder  # type: ignore[assignment]
_routing.jsonable_encoder = _camel_jsonable_encoder  # patch the local ref in routing too
# ──────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from core.database import engine, Base
from routers import auth, rfp, decision, proposal, knowledge, analytics, notifications, users, audit, templates

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup and shutdown."""
    # Fix Bug #S3: refuse to start with the default placeholder JWT secret in production.
    # A known secret means any attacker can forge valid JWTs for any user and role.
    _INSECURE_JWT_DEFAULTS = {
        "change_me_use_256_bit_random_string",
        "entropy-rfp-dev-secret-key-change-in-production-2024",
    }
    if settings.is_production and settings.jwt_secret_key in _INSECURE_JWT_DEFAULTS:
        raise RuntimeError(
            "FATAL: JWT_SECRET_KEY is set to the default placeholder value. "
            "Generate a secure 256-bit random secret before running in production: "
            "python -c \"import secrets; print(secrets.token_hex(32))\""
        )

    logger.info("Starting Entropy RFP Platform API", environment=settings.environment)
    # Create all tables if they don't exist (use Alembic for production migrations)
    if settings.is_development:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Enable WAL mode for SQLite — allows concurrent readers + writer,
            # preventing "database is locked" errors from background async tasks.
            if settings.database_url.startswith("sqlite"):
                await conn.execute(__import__("sqlalchemy").text("PRAGMA journal_mode=WAL"))
                await conn.execute(__import__("sqlalchemy").text("PRAGMA busy_timeout=30000"))
    yield
    logger.info("Shutting down Entropy RFP Platform API")
    await engine.dispose()


app = FastAPI(
    title="Entropy RFP Intelligence Platform API",
    description="Internal API for qualifying Saudi government RFPs and generating proposals.",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(rfp.router)
app.include_router(decision.router)
app.include_router(proposal.router)
app.include_router(proposal.direct_router)
app.include_router(knowledge.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(templates.router)


# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception", path=request.url.path, error=str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again later."},
    )


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for load balancers and Docker healthcheck."""
    return {"status": "ok", "service": "entropy-rfp-api"}
