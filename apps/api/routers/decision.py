"""Decision router — qualification results and overrides."""

import json
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.rbac import Permission
from core.security import get_current_user, require_permission
from models.decision import Decision
from models.flag import Flag
from models.rfp import RFP
from models.user import User
from schemas.decision import (
    DecisionResponse,
    FlagResponse,
    ManualEvidenceRequest,
    OverrideRequest,
    ScoreBreakdown,
    WeightAdjustRequest,
)
from services.audit import log_action

router = APIRouter(prefix="/rfps", tags=["decision"])


@router.get("/{rfp_id}/decision", response_model=DecisionResponse)
async def get_decision(
    rfp_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_RFP))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DecisionResponse:
    """Get the qualification decision for an RFP."""
    result = await db.execute(
        select(Decision).options(selectinload(Decision.flags)).where(Decision.rfp_id == rfp_id)
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not yet available")

    return _build_decision_response(decision)


@router.post("/{rfp_id}/decision/override", response_model=DecisionResponse)
async def override_decision(
    rfp_id: uuid.UUID,
    body: OverrideRequest,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.OVERRIDE_DECISION))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DecisionResponse:
    """Human override of the AI decision — requires justification, always logged."""
    result = await db.execute(
        select(Decision).options(selectinload(Decision.flags)).where(Decision.rfp_id == rfp_id)
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

    old_decision = decision.decision_type
    decision.original_decision_type = old_decision if not decision.is_overridden else decision.original_decision_type
    decision.decision_type = body.new_decision
    decision.is_overridden = True
    decision.override_by = current_user.id
    decision.override_reason = body.reason
    decision.override_at = datetime.now(UTC)

    await log_action(
        db,
        current_user.id,
        "override_decision",
        "decision",
        str(decision.id),
        old_value=json.dumps({"decision": old_decision}),
        new_value=json.dumps({"decision": body.new_decision, "reason": body.reason}),
        ip_address=request.client.host if request.client else None,
    )

    return _build_decision_response(decision)


@router.put("/{rfp_id}/decision/weights", response_model=DecisionResponse)
async def adjust_weights(
    rfp_id: uuid.UUID,
    body: WeightAdjustRequest,
    request: Request,
    # Fix Bug #4: was VIEW_RFP, which allowed READ_ONLY users to rewrite decision scores
    current_user: Annotated[User, Depends(require_permission(Permission.OVERRIDE_DECISION))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DecisionResponse:
    """Recompute the decision score with custom dimension weights."""
    result = await db.execute(
        select(Decision).options(selectinload(Decision.flags)).where(Decision.rfp_id == rfp_id)
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

    old_total = decision.total_score
    old_decision_type = decision.decision_type

    # Recompute total with new weights
    technical = decision.technical_fit * body.technical_weight
    business = decision.business_fit * body.business_weight
    risk = decision.risk_penalty * body.risk_weight
    new_total = max(0.0, min(100.0, technical + business - risk))

    decision.total_score = new_total
    decision.technical_weight = body.technical_weight
    decision.business_weight = body.business_weight
    decision.risk_weight = body.risk_weight

    # Reapply decision logic
    from services.qualification_service import apply_decision_logic
    decision.decision_type = apply_decision_logic(new_total, decision.flags)

    await log_action(
        db,
        current_user.id,
        "adjust_weights",
        "decision",
        str(decision.id),
        old_value=json.dumps({"total_score": old_total, "decision_type": old_decision_type}),
        new_value=json.dumps({
            "total_score": new_total,
            "decision_type": decision.decision_type,
            "technical_weight": body.technical_weight,
            "business_weight": body.business_weight,
            "risk_weight": body.risk_weight,
        }),
        ip_address=request.client.host if request.client else None,
    )

    return _build_decision_response(decision)


@router.post("/{rfp_id}/decision/evidence", response_model=FlagResponse, status_code=status.HTTP_201_CREATED)
async def add_manual_evidence(
    rfp_id: uuid.UUID,
    body: ManualEvidenceRequest,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.OVERRIDE_DECISION))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FlagResponse:
    """Add a manually entered red/green flag with evidence."""
    result = await db.execute(select(Decision).where(Decision.rfp_id == rfp_id))
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

    flag = Flag(
        decision_id=decision.id,
        flag_type=body.flag_type,
        severity=body.severity,
        title_ar=body.title_ar,
        title_en=body.title_en,
        description_ar=body.description_ar,
        description_en=body.description_en,
        page_number=body.page_number,
        section_name=body.section_name,
        evidence_quote=body.evidence_quote,
        is_manual=True,
        added_by=current_user.id,
    )
    db.add(flag)
    await db.flush()

    await log_action(db, current_user.id, "add_manual_evidence", "decision", str(decision.id), ip_address=request.client.host if request.client else None)
    return FlagResponse.model_validate(flag)


def _build_decision_response(decision: Decision) -> DecisionResponse:
    """Build a full DecisionResponse from a Decision model instance."""
    breakdown = ScoreBreakdown(
        technical_fit=decision.technical_fit,
        business_fit=decision.business_fit,
        risk_penalty=decision.risk_penalty,
        capability_match=decision.capability_match_score,
        past_similarity=decision.past_similarity_score,
        tech_stack=decision.tech_stack_score,
        certifications=decision.certifications_score,
        project_value=decision.project_value_score,
        strategic_account=decision.strategic_account_score,
        margin=decision.margin_score,
        sales_cycle=decision.sales_cycle_score,
        compliance_risk=decision.compliance_risk_score,
        delivery_risk=decision.delivery_risk_score,
        financial_risk=decision.financial_risk_score,
        competition_risk=decision.competition_risk_score,
    )

    sections = json.loads(decision.sections_needing_review or "[]")
    red_flags = [FlagResponse.model_validate(f) for f in decision.flags if f.flag_type == "RED"]
    green_flags = [FlagResponse.model_validate(f) for f in decision.flags if f.flag_type == "GREEN"]

    return DecisionResponse(
        id=decision.id,
        rfp_id=decision.rfp_id,
        decision_type=decision.decision_type,
        total_score=decision.total_score,
        breakdown=breakdown,
        confidence=decision.confidence,
        explanation_ar=decision.explanation_ar,
        explanation_en=decision.explanation_en,
        red_flags=red_flags,
        green_flags=green_flags,
        sections_needing_review=sections,
        is_overridden=decision.is_overridden,
        original_decision_type=decision.original_decision_type,
        override_reason=decision.override_reason,
        override_at=decision.override_at,
        model_version=decision.model_version,
        created_at=decision.created_at,
    )
