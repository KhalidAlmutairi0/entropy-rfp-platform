"""Proposal and section schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from schemas.common import CamelModel


class CitationRef(CamelModel):
    source_id: str
    source_type: str  # RFP | PAST_PROPOSAL | CAPABILITY | CASE_STUDY
    source_title: str
    chunk_text: str
    page_number: int | None = None


class UngroundedClaim(CamelModel):
    text: str
    reason: str


class ProposalSectionResponse(CamelModel):
    id: uuid.UUID
    order_index: int
    title_ar: str | None
    title_en: str | None
    content_ar: str | None
    content_en: str | None
    is_ai_generated: bool
    is_locked: bool
    confidence: float | None
    has_ungrounded_claims: bool
    citations: list[CitationRef] = []
    word_count: int


class ProposalSectionUpdate(BaseModel):
    content_ar: str | None = None
    content_en: str | None = None
    title_ar: str | None = None
    title_en: str | None = None
    order_index: int | None = None


class RegenerateRequest(BaseModel):
    section_id: str
    instructions: str | None = None
    language: str = "ar"


# ── Agenda / section definition used at creation time ────────────────────────

class SectionDef(BaseModel):
    """A single agenda section provided by the user or suggested by AI."""
    title_en: str
    title_ar: str
    is_locked: bool = False


class AgendaSuggestion(CamelModel):
    """Returned by the suggest-agenda endpoint."""
    sections: list[SectionDef]
    basis: str  # "template" | "rfp_analysis" | "default"
    matched_capabilities: list[str] = []


# ── Proposal creation ─────────────────────────────────────────────────────────

class ProposalCreate(BaseModel):
    template_id: str | None = None
    mode: str = "QUALIFIED"           # "QUALIFIED" | "DIRECT"
    custom_sections: list[SectionDef] | None = None   # User-defined agenda
    use_ai_agenda: bool = False       # True → system suggests agenda from RFP


# ── Direct proposal creation (Mode 2, no RFP required) ───────────────────────

class DirectProposalCreate(BaseModel):
    title: str                        # Proposal title (required for Mode 2)
    description: str | None = None   # Optional context / brief
    template_id: str | None = None
    custom_sections: list[SectionDef] | None = None
    use_ai_agenda: bool = True        # Default to AI agenda for direct proposals


# ── Response schemas ──────────────────────────────────────────────────────────

class ProposalResponse(CamelModel):
    id: uuid.UUID
    rfp_id: uuid.UUID
    template_id: uuid.UUID | None
    mode: str
    title: str | None
    status: str
    current_version: int
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    submitted_at: datetime | None
    outcome: str
    created_at: datetime
    updated_at: datetime
    sections: list[ProposalSectionResponse] = []


class ExportConfig(BaseModel):
    format: str = "pdf"  # pdf | docx | both
    include_cover: bool = True
    include_toc: bool = True
    include_section_numbers: bool = True
    include_watermark: bool = False
    include_footer: bool = True
    branding: str = "default"
    language: str = "ar"  # ar | en | both


class OutcomeUpdate(BaseModel):
    outcome: str  # PENDING | WON | LOST | WITHDRAWN
    notes: str | None = None
