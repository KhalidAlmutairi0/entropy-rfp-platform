"""RFP schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from schemas.common import CamelModel


class RFPFileResponse(CamelModel):
    id: uuid.UUID
    filename: str
    file_type: str
    size_bytes: int
    page_count: int
    is_ocr_required: bool
    ocr_confidence: float | None
    status: str


class RFPCreate(BaseModel):
    title_ar: str | None = None
    title_en: str | None = None
    agency: str | None = None
    tender_number: str | None = None
    language: str = "AR"
    deadline: datetime | None = None
    estimated_value_sar: float | None = None


class RFPUpdate(BaseModel):
    title_ar: str | None = None
    title_en: str | None = None
    agency: str | None = None
    tender_number: str | None = None
    language: str | None = None
    deadline: datetime | None = None
    estimated_value_sar: float | None = None
    status: str | None = None


class RFPResponse(CamelModel):
    id: uuid.UUID
    title_ar: str | None
    title_en: str | None
    agency: str | None
    tender_number: str | None
    language: str
    status: str
    deadline: datetime | None
    estimated_value_sar: float | None
    owner_id: uuid.UUID
    file_count: int
    total_pages: int
    ocr_confidence: float | None
    created_at: datetime
    updated_at: datetime
    files: list[RFPFileResponse] = []


class RFPListResponse(CamelModel):
    id: uuid.UUID
    title_ar: str | None
    title_en: str | None
    agency: str | None
    status: str
    deadline: datetime | None
    estimated_value_sar: float | None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    fit_score: float | None = None  # Populated from Decision table
    decision_type: str | None = None  # Populated from Decision table


class RFPFilter(BaseModel):
    status: str | None = None
    agency: str | None = None
    owner_id: str | None = None
    language: str | None = None
    search: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    page: int = 1
    page_size: int = 20
