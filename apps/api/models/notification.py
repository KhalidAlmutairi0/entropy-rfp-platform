"""Notification model."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class NotificationType(str, Enum):
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE"
    ANALYSIS_BLOCKED = "ANALYSIS_BLOCKED"
    ANALYSIS_FAILED = "ANALYSIS_FAILED"
    MENTION = "MENTION"
    APPROVAL_REQUEST = "APPROVAL_REQUEST"
    APPROVAL_RECEIVED = "APPROVAL_RECEIVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    NEW_RFP = "NEW_RFP"
    DEADLINE_APPROACHING = "DEADLINE_APPROACHING"
    SYSTEM = "SYSTEM"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title_ar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    title_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    deep_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
