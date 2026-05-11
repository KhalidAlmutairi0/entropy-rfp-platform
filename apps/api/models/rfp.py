"""RFP (Request for Proposal) model."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class RFPStatus(str, Enum):
    UPLOADED = "UPLOADED"
    ANALYZING = "ANALYZING"
    DECISION_READY = "DECISION_READY"
    ACTION_REQUIRED = "ACTION_REQUIRED"
    DRAFTING = "DRAFTING"
    IN_REVIEW = "IN_REVIEW"
    SUBMITTED = "SUBMITTED"
    WON = "WON"
    LOST = "LOST"
    ARCHIVED = "ARCHIVED"
    DIRECT = "DIRECT"  # Mode 2: direct proposal, no qualification


class RFPLanguage(str, Enum):
    AR = "AR"
    EN = "EN"
    MIXED = "MIXED"


class RFP(Base):
    __tablename__ = "rfps"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    title_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    title_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    agency: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    tender_number: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    language: Mapped[str] = mapped_column(String(10), default=RFPLanguage.AR.value, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default=RFPStatus.UPLOADED.value, nullable=False, index=True
    )
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_value_sar: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=False, index=True)
    # Denormalized display name — immutable after upload, shown as "Checked by: ..."
    uploaded_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Deck generation
    deck_pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    deck_status: Mapped[str | None] = mapped_column(String(50), nullable=True)  # None | PENDING | GENERATING | READY | FAILED
    deck_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_pages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
    processing_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="rfps", foreign_keys=[owner_id])
    files: Mapped[list["RFPFile"]] = relationship("RFPFile", back_populates="rfp", cascade="all, delete-orphan")
    decision: Mapped["Decision | None"] = relationship("Decision", back_populates="rfp", uselist=False)
    proposal: Mapped["Proposal | None"] = relationship("Proposal", back_populates="rfp", uselist=False)

    @property
    def title(self) -> str:
        return self.title_ar or self.title_en or "Untitled RFP"

    def __repr__(self) -> str:
        return f"<RFP {self.id} [{self.status}]>"
