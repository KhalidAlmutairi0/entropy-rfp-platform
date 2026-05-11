"""Knowledge base schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from schemas.common import CamelModel


class KnowledgeDocCreate(BaseModel):
    title: str
    doc_type: str
    language: str = "AR"
    year: int | None = None
    tags: list[str] = []
    outcome: str = "NA"


class KnowledgeDocUpdate(BaseModel):
    title: str | None = None
    doc_type: str | None = None
    language: str | None = None
    year: int | None = None
    tags: list[str] | None = None
    outcome: str | None = None


class KnowledgeDocResponse(CamelModel):
    id: uuid.UUID
    title: str
    doc_type: str
    language: str
    year: int | None = None
    tags: list[str] = []
    is_indexed: bool
    embedding_model: str | None = None
    indexed_at: datetime | None = None
    last_used_at: datetime | None = None
    used_count: int
    outcome: str
    size_bytes: int
    created_at: datetime


class KBStats(CamelModel):
    total: int
    indexed: int
    failed: int
    last_sync_at: datetime | None = None
    by_type: dict[str, int]
