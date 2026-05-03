"""Knowledge base document model."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class DocType(str, Enum):
    PAST_PROPOSAL = "PAST_PROPOSAL"
    CAPABILITY = "CAPABILITY"
    CASE_STUDY = "CASE_STUDY"
    TEMPLATE = "TEMPLATE"
    COMPLIANCE = "COMPLIANCE"
    OTHER = "OTHER"


class DocOutcome(str, Enum):
    WIN = "WIN"
    LOSS = "LOSS"
    NA = "NA"


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(10), default="AR", nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    outcome: Mapped[str] = mapped_column(String(10), default=DocOutcome.NA.value, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
