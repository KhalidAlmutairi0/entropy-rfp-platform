"""Async SQLAlchemy database setup."""

import uuid
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import String
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool, StaticPool
from sqlalchemy.types import TypeDecorator


class GUID(TypeDecorator):
    """Cross-database UUID type.
    Uses PostgreSQL's native UUID when available; stores as VARCHAR(36) on SQLite.
    Always returns a Python uuid.UUID object.
    """
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return str(uuid.UUID(str(value)))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))

from core.config import settings

# SQLite doesn't support pool_size/max_overflow
_is_sqlite = settings.database_url.startswith("sqlite")
# Disable SQLAlchemy SQL echo on Windows dev — Arabic text in SQL logs
# causes UnicodeEncodeError when the console uses a non-UTF-8 codec (cp1252).
_engine_kwargs: dict = {"echo": False}
if _is_sqlite:
    # StaticPool: share a single connection across all sessions so SQLite never
    # sees two concurrent writers and "database is locked" errors are eliminated.
    # check_same_thread=False is required for aiosqlite's thread-handoff model.
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["poolclass"] = StaticPool
else:
    _engine_kwargs.update({"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20})

engine = create_async_engine(settings.database_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    type_annotation_map: dict[Any, Any] = {}


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a database session and closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
