"""Red/Green flag model — evidence items for a qualification decision."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class FlagType(str, Enum):
    RED = "RED"
    GREEN = "GREEN"


class FlagSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"


class Flag(Base):
    __tablename__ = "flags"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    decision_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    flag_type: Mapped[str] = mapped_column(String(10), nullable=False)  # RED | GREEN
    severity: Mapped[str] = mapped_column(String(10), nullable=True)  # CRITICAL | MAJOR | MINOR (red only)
    flag_code: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "MANDATORY_CERT_NOT_HELD"
    title_ar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_number: Mapped[int | None] = mapped_column(nullable=True)
    section_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    evidence_quote: Mapped[str | None] = mapped_column(Text, nullable=True)  # Exact quote from RFP
    is_manual: Mapped[bool] = mapped_column(default=False, nullable=False)  # Added by human
    added_by: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    decision: Mapped["Decision"] = relationship("Decision", back_populates="flags")
