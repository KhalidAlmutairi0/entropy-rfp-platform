"""Proposal section model."""

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ProposalSection(Base):
    __tablename__ = "proposal_sections"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    title_ar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Manual-only sections
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_ungrounded_claims: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ungrounded_claims_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    citations_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of citations
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    generation_prompt_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
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
    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="sections")

    @property
    def citations(self) -> list[dict]:
        if not self.citations_json:
            return []
        try:
            data = json.loads(self.citations_json)
        except json.JSONDecodeError:
            return []
        return data if isinstance(data, list) else []
