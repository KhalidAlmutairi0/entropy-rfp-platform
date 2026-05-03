"""Decision and flag schemas."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from schemas.common import CamelModel


class FlagResponse(CamelModel):
    id: uuid.UUID
    flag_type: str
    severity: str | None
    flag_code: str | None
    title_ar: str | None
    title_en: str | None
    description_ar: str | None
    description_en: str | None
    page_number: int | None
    section_name: str | None
    evidence_quote: str | None
    is_manual: bool


class ScoreBreakdown(CamelModel):
    technical_fit: float
    business_fit: float
    risk_penalty: float
    # Sub-scores
    capability_match: float
    past_similarity: float
    tech_stack: float
    certifications: float
    project_value: float
    strategic_account: float
    margin: float
    sales_cycle: float
    compliance_risk: float
    delivery_risk: float
    financial_risk: float
    competition_risk: float


class DecisionResponse(CamelModel):
    id: uuid.UUID
    rfp_id: uuid.UUID
    decision_type: str
    total_score: float
    breakdown: ScoreBreakdown
    confidence: float
    explanation_ar: str | None
    explanation_en: str | None
    red_flags: list[FlagResponse]
    green_flags: list[FlagResponse]
    sections_needing_review: list[str]
    is_overridden: bool
    original_decision_type: str | None
    override_reason: str | None
    override_at: datetime | None
    model_version: str | None
    created_at: datetime


class OverrideRequest(BaseModel):
    new_decision: Literal["GO", "NO_GO", "REVIEW"]
    reason: str = Field(..., min_length=10, max_length=2000)


class WeightAdjustRequest(BaseModel):
    technical_weight: float = Field(default=1.0, ge=0.0, le=3.0)
    business_weight: float = Field(default=1.0, ge=0.0, le=3.0)
    risk_weight: float = Field(default=1.0, ge=0.0, le=3.0)


class ManualEvidenceRequest(BaseModel):
    flag_type: Literal["RED", "GREEN"]
    severity: Literal["CRITICAL", "MAJOR", "MINOR"] | None = None
    title_ar: str | None = Field(default=None, max_length=500)
    title_en: str | None = Field(default=None, max_length=500)
    description_ar: str | None = Field(default=None, max_length=4000)
    description_en: str | None = Field(default=None, max_length=4000)
    page_number: int | None = Field(default=None, ge=1)
    section_name: str | None = Field(default=None, max_length=200)
    evidence_quote: str | None = Field(default=None, max_length=2000)
