"""User model."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, String
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from core.rbac import Role


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)  # None = SSO only
    role: Mapped[str] = mapped_column(String(50), nullable=False, default=Role.PRE_SALES.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="ar", nullable=False)
    preferred_timezone: Mapped[str] = mapped_column(String(100), default="Asia/Riyadh", nullable=False)
    notification_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_slack: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    rfps: Mapped[list["RFP"]] = relationship("RFP", back_populates="owner", foreign_keys="RFP.owner_id")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user")

    def __repr__(self) -> str:
        return f"<User {self.email} [{self.role}]>"
