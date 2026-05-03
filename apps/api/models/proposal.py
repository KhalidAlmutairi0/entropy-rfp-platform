"""Proposal model."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ProposalMode(str, Enum):
    QUALIFIED = "QUALIFIED"  # Mode 1: RFP analyzed → Go/Review → proposal
    DIRECT = "DIRECT"        # Mode 2: direct proposal, no qualification


class ProposalStatus(str, Enum):
    DRAFTING = "DRAFTING"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    EXPORTED = "EXPORTED"


class ProposalOutcome(str, Enum):
    PENDING = "PENDING"
    WON = "WON"
    LOST = "LOST"
    WITHDRAWN = "WITHDRAWN"


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    rfp_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    mode: Mapped[str] = mapped_column(String(20), default=ProposalMode.QUALIFIED.value, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)  # For direct proposals
    status: Mapped[str] = mapped_column(String(20), default=ProposalStatus.DRAFTING.value, nullable=False)
    current_version: Mapped[int] = mapped_column(default=1, nullable=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str] = mapped_column(String(20), default=ProposalOutcome.PENDING.value, nullable=False)
    outcome_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    rfp: Mapped["RFP"] = relationship("RFP", back_populates="proposal")
    sections: Mapped[list["ProposalSection"]] = relationship(
        "ProposalSection", back_populates="proposal", cascade="all, delete-orphan", order_by="ProposalSection.order_index"
    )
