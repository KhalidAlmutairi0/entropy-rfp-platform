"""RFP file attachment model."""

import uuid
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from core.database import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class FileType(str, Enum):
    MAIN = "MAIN"
    ANNEX = "ANNEX"
    CONTRACT = "CONTRACT"
    PRICING = "PRICING"
    OTHER = "OTHER"


class FileStatus(str, Enum):
    UPLOADING = "UPLOADING"
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class RFPFile(Base):
    __tablename__ = "rfp_files"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(), primary_key=True, default=uuid.uuid4
    )
    rfp_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), default=FileType.MAIN.value, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_ocr_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=FileStatus.UPLOADING.value, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    rfp: Mapped["RFP"] = relationship("RFP", back_populates="files")
