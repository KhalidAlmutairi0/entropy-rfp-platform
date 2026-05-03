"""Decision model — the Go/No-Go/Review result for an RFP."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DecisionType(str, Enum):
    GO = "GO"
    NO_GO = "NO_GO"
    REVIEW = "REVIEW"


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    rfp_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    decision_type: Mapped[str] = mapped_column(String(10), nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    technical_fit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    business_fit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_penalty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    explanation_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    sections_needing_review: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array as string
    # Technical breakdown
    capability_match_score: Mapped[float] = mapped_column(Float, default=0.0)
    past_similarity_score: Mapped[float] = mapped_column(Float, default=0.0)
    tech_stack_score: Mapped[float] = mapped_column(Float, default=0.0)
    certifications_score: Mapped[float] = mapped_column(Float, default=0.0)
    # Business breakdown
    project_value_score: Mapped[float] = mapped_column(Float, default=0.0)
    strategic_account_score: Mapped[float] = mapped_column(Float, default=0.0)
    margin_score: Mapped[float] = mapped_column(Float, default=0.0)
    sales_cycle_score: Mapped[float] = mapped_column(Float, default=0.0)
    # Risk breakdown
    compliance_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    delivery_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    financial_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    competition_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    # Override
    is_overridden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    original_decision_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    override_by: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Meta
    model_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processing_time_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Score weights used (may differ from defaults if user adjusted)
    technical_weight: Mapped[float] = mapped_column(Float, default=1.0)
    business_weight: Mapped[float] = mapped_column(Float, default=1.0)
    risk_weight: Mapped[float] = mapped_column(Float, default=1.0)

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
    rfp: Mapped["RFP"] = relationship("RFP", back_populates="decision")
    flags: Mapped[list["Flag"]] = relationship("Flag", back_populates="decision", cascade="all, delete-orphan")
