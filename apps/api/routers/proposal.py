"""Proposal generation and editing router."""

import json
import uuid
from pathlib import Path
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.rbac import Permission
from core.security import require_permission
from models.proposal import Proposal, ProposalStatus
from models.proposal_section import ProposalSection
from models.rfp import RFP, RFPStatus
from models.user import User
from schemas.proposal import (
    AgendaSuggestion,
    DirectProposalCreate,
    ExportConfig,
    OutcomeUpdate,
    ProposalCreate,
    ProposalResponse,
    ProposalSectionResponse,
    ProposalSectionUpdate,
    RegenerateRequest,
    SectionDef,
)
from services.audit import log_action

router = APIRouter(prefix="/rfps", tags=["proposal"])
direct_router = APIRouter(prefix="/proposals", tags=["proposal"])


@router.get("/{rfp_id}/proposal/suggest-agenda", response_model=AgendaSuggestion)
async def suggest_agenda(
    rfp_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_permission(Permission.GENERATE_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AgendaSuggestion:
    """Suggest an agenda (sections) for a proposal based on the RFP analysis."""
    from models.template import Template, TemplateSection
    from sqlalchemy import select as sa_select

    rfp_result = await db.execute(select(RFP).where(RFP.id == rfp_id, RFP.is_deleted == False))  # noqa: E712
    rfp = rfp_result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")

    tmpl_result = await db.execute(sa_select(Template).order_by(Template.used_count.desc()).limit(1))
    template = tmpl_result.scalar_one_or_none()

    if template:
        sec_result = await db.execute(
            sa_select(TemplateSection)
            .where(TemplateSection.template_id == template.id)
            .order_by(TemplateSection.order_index)
        )
        template_sections = sec_result.scalars().all()
        sections = [SectionDef(title_en=s.title_en or "", title_ar=s.title_ar or "") for s in template_sections]
        return AgendaSuggestion(sections=sections, basis="template")

    from tasks.proposal_tasks import DEFAULT_SECTIONS
    sections = [SectionDef(title_en=s["title_en"], title_ar=s["title_ar"]) for s in DEFAULT_SECTIONS]
    return AgendaSuggestion(sections=sections, basis="default")


@router.post("/{rfp_id}/proposal", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    rfp_id: uuid.UUID,
    body: ProposalCreate,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.GENERATE_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
) -> ProposalResponse:
    """Create a proposal for an RFP and trigger section generation."""
    rfp_result = await db.execute(select(RFP).where(RFP.id == rfp_id, RFP.is_deleted == False))  # noqa: E712
    rfp = rfp_result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")

    sections_to_use = None
    if body.custom_sections:
        sections_to_use = [s.model_dump() for s in body.custom_sections]
    elif body.use_ai_agenda:
        from models.template import Template, TemplateSection
        tmpl_result = await db.execute(select(Template).order_by(Template.used_count.desc()).limit(1))
        template = tmpl_result.scalar_one_or_none()
        if template:
            sec_result = await db.execute(
                select(TemplateSection)
                .where(TemplateSection.template_id == template.id)
                .order_by(TemplateSection.order_index)
            )
            sections_to_use = [
                {
                    "title_en": s.title_en or "",
                    "title_ar": s.title_ar or "",
                    "is_locked": False,
                    "is_auto_generated": s.is_auto_generated,
                    "ai_instructions": s.ai_instructions,
                    "word_count_target": s.word_count_target,
                }
                for s in sec_result.scalars().all()
            ]

    existing = await db.execute(
        select(Proposal).options(selectinload(Proposal.sections)).where(Proposal.rfp_id == rfp_id, Proposal.is_deleted == False)  # noqa: E712
    )
    existing_proposal = existing.scalar_one_or_none()
    if existing_proposal:
        # Fix: pass the async function directly so FastAPI awaits it in the same event loop.
        # Passing the Celery task wrapper calls asyncio.run() inside an already-running loop → silent crash.
        from tasks.proposal_tasks import _generate_sections_async

        if body.template_id:
            existing_proposal.template_id = uuid.UUID(body.template_id)
        existing_proposal.status = ProposalStatus.DRAFTING.value
        await db.commit()
        background_tasks.add_task(
            _generate_sections_async,
            str(existing_proposal.id),
            str(rfp_id),
            sections_to_use,
        )
        result = await db.execute(
            select(Proposal).options(selectinload(Proposal.sections)).where(Proposal.id == existing_proposal.id)
        )
        return ProposalResponse.model_validate(result.scalar_one())

    proposal = Proposal(
        rfp_id=rfp_id,
        template_id=uuid.UUID(body.template_id) if body.template_id else None,
        mode=body.mode,
    )
    db.add(proposal)
    await db.flush()

    # Use the async function directly so FastAPI awaits it in the same event loop.
    # Passing the Celery task wrapper calls asyncio.run() inside an already-running loop,
    # which creates a second SQLite connection that race-locks the database.
    from tasks.proposal_tasks import _generate_sections_async
    background_tasks.add_task(_generate_sections_async, str(proposal.id), str(rfp_id), sections_to_use)

    await log_action(db, current_user.id, "create_proposal", "proposal", str(proposal.id), ip_address=request.client.host if request.client else None)

    result = await db.execute(
        select(Proposal).options(selectinload(Proposal.sections)).where(Proposal.id == proposal.id)
    )
    return ProposalResponse.model_validate(result.scalar_one())


@router.get("/{rfp_id}/proposal", response_model=ProposalResponse)
async def get_proposal(
    rfp_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_RFP))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProposalResponse:
    result = await db.execute(
        select(Proposal)
        .options(selectinload(Proposal.sections))
        .where(Proposal.rfp_id == rfp_id, Proposal.is_deleted == False)  # noqa: E712
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    return ProposalResponse.model_validate(proposal)


@router.put("/{rfp_id}/proposal/sections/{section_id}", response_model=ProposalSectionResponse)
async def update_section(
    rfp_id: uuid.UUID,
    section_id: uuid.UUID,
    body: ProposalSectionUpdate,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.EDIT_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProposalSectionResponse:
    result = await db.execute(
        select(ProposalSection)
        .join(Proposal)
        .where(Proposal.rfp_id == rfp_id, ProposalSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    if section.is_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This section is locked for manual entry only")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(section, key, val)
    section.is_ai_generated = False

    await log_action(db, current_user.id, "edit_section", "proposal_section", str(section_id), ip_address=request.client.host if request.client else None)
    return ProposalSectionResponse.model_validate(section)


@router.post("/{rfp_id}/proposal/sections/{section_id}/regenerate")
async def regenerate_section(
    rfp_id: uuid.UUID,
    section_id: uuid.UUID,
    body: RegenerateRequest,
    current_user: Annotated[User, Depends(require_permission(Permission.EDIT_PROPOSAL))],
) -> StreamingResponse:
    """Stream regenerated section content via SSE."""
    from services.proposal_generator_service import regenerate_section_stream

    async def stream() -> AsyncGenerator[str, None]:
        async for chunk in regenerate_section_stream(str(section_id), body.instructions, body.language):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.post("/{rfp_id}/proposal/export", status_code=status.HTTP_202_ACCEPTED)
async def export_proposal(
    rfp_id: uuid.UUID,
    config: ExportConfig,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.EXPORT_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """Trigger proposal export in DOCX and/or PDF format."""
    result = await db.execute(
        select(Proposal)
        .options(selectinload(Proposal.sections))
        .where(Proposal.rfp_id == rfp_id, Proposal.is_deleted == False)  # noqa: E712
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")

    if proposal.status not in [ProposalStatus.APPROVED.value, ProposalStatus.IN_REVIEW.value]:
        if proposal.status == ProposalStatus.DRAFTING.value:
            non_locked = [s for s in proposal.sections if not s.is_locked]
            has_full_content = bool(non_locked) and all(
                ((s.content_ar or s.content_en or "").strip() and (s.content_ar or s.content_en or "").strip().lower() != "undefined")
                for s in non_locked
            )
            if not has_full_content:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Generate complete content for all non-locked sections before export",
                )
            proposal.status = ProposalStatus.IN_REVIEW.value
        else:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Proposal must be approved before export")

    task_id = str(uuid.uuid4())

    # Fix Bug #14: add a BackgroundTasks fallback when Celery broker is unavailable
    try:
        from tasks.export_tasks import export_proposal_task
        celery_task = export_proposal_task.delay(str(proposal.id), config.model_dump())
        task_id = celery_task.id
    except Exception:
        import asyncio
        from tasks.export_tasks import _export_proposal_async

        def _run(pid: str, cfg: dict) -> None:
            asyncio.run(_export_proposal_async(pid, cfg))

        background_tasks.add_task(_run, str(proposal.id), config.model_dump())

    await log_action(db, current_user.id, "export_proposal", "proposal", str(proposal.id), ip_address=request.client.host if request.client else None)
    return {"task_id": task_id, "status": "queued"}


@router.patch("/{rfp_id}/proposal/outcome")
async def update_outcome(
    rfp_id: uuid.UUID,
    body: OutcomeUpdate,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.EDIT_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Record the final outcome (Won/Lost/Withdrawn) for analytics."""
    result = await db.execute(select(Proposal).where(Proposal.rfp_id == rfp_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")

    proposal.outcome = body.outcome
    proposal.outcome_notes = body.notes

    await log_action(db, current_user.id, "record_outcome", "proposal", str(proposal.id),
                     new_value=json.dumps({"outcome": body.outcome}),
                     ip_address=request.client.host if request.client else None)
    return {"outcome": body.outcome}


# ── Deck generation — Docling → Claude → PptxGenJS pipeline ──────────────────

@router.post("/{rfp_id}/generate-deck", status_code=status.HTTP_202_ACCEPTED)
async def generate_deck(
    rfp_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_permission(Permission.GENERATE_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
    template_file: UploadFile | None = File(None),
) -> dict[str, str]:
    """Trigger the Docling → Claude → PptxGenJS deck generation pipeline.

    Optionally upload a .pptx or .docx file as the slide-layout template.
    If omitted, the service falls back to the template stored in MinIO at
    ``templates/master_proposal.pptx`` (or ``.docx``), or the ``DECK_TEMPLATE_PATH``
    environment variable.

    The pipeline runs as a FastAPI background task. Poll the RFP ``deckStatus``
    field: PENDING → GENERATING → READY | FAILED.
    """
    from services.deck_service import _load_template_from_storage, _run_deck_pipeline_async
    from services.storage import StorageService

    result = await db.execute(
        select(RFP).options(selectinload(RFP.files)).where(RFP.id == rfp_id, RFP.is_deleted == False)  # noqa: E712
    )
    rfp = result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")

    allowed_statuses = {
        "DECISION_READY", "ACTION_REQUIRED", "DRAFTING",
        "IN_REVIEW", "SUBMITTED", "WON", "DIRECT",
    }
    if rfp.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="RFP must have a completed decision before generating a deck.",
        )

    if rfp.deck_status == "GENERATING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Deck generation is already in progress.",
        )

    # ── Resolve template ──────────────────────────────────────────────────────
    template_bytes: bytes | None = None
    template_filename: str = "template.pptx"

    if template_file and template_file.filename:
        fname = template_file.filename
        ext = Path(fname).suffix.lower()
        if ext not in (".pptx", ".docx"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Template must be a .pptx or .docx file, got '{ext}'.",
            )
        template_bytes = await template_file.read()
        template_filename = fname
    else:
        storage = StorageService.get_instance()
        loaded = await _load_template_from_storage(storage)
        if loaded:
            template_bytes, template_filename = loaded

    if not template_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No template file found. Upload a .pptx or .docx template in the request, "
                "or store one in MinIO at templates/master_proposal.pptx (or .docx), "
                "or set the DECK_TEMPLATE_PATH environment variable."
            ),
        )

    # ── Kick off background task ──────────────────────────────────────────────
    task_id = str(uuid.uuid4())
    rfp.deck_status = "PENDING"
    rfp.deck_task_id = task_id
    await log_action(
        db, current_user.id, "generate_deck", "rfp", str(rfp_id),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    background_tasks.add_task(
        _run_deck_pipeline_async,
        str(rfp_id),
        template_bytes,
        template_filename,
    )

    return {"task_id": task_id, "status": "queued"}


# ── Mode 2: Direct proposal (no RFP qualification required) ───────────────────

@direct_router.post("/direct", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
async def create_direct_proposal(
    body: DirectProposalCreate,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.GENERATE_PROPOSAL))],
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
) -> ProposalResponse:
    """Mode 2: Create a proposal without an RFP qualification step."""
    from datetime import UTC, datetime

    stub_rfp = RFP(
        title_en=body.title,
        title_ar=body.title,
        status=RFPStatus.DIRECT.value,
        owner_id=current_user.id,
    )
    db.add(stub_rfp)
    await db.flush()

    sections_to_use = None
    if body.custom_sections:
        sections_to_use = [s.model_dump() for s in body.custom_sections]
    elif body.use_ai_agenda:
        from models.template import Template, TemplateSection
        tmpl_result = await db.execute(select(Template).order_by(Template.used_count.desc()).limit(1))
        template = tmpl_result.scalar_one_or_none()
        if template:
            sec_result = await db.execute(
                select(TemplateSection)
                .where(TemplateSection.template_id == template.id)
                .order_by(TemplateSection.order_index)
            )
            sections_to_use = [
                {
                    "title_en": s.title_en or "",
                    "title_ar": s.title_ar or "",
                    "is_locked": False,
                    "is_auto_generated": s.is_auto_generated,
                    "ai_instructions": s.ai_instructions,
                    "word_count_target": s.word_count_target,
                }
                for s in sec_result.scalars().all()
            ]

    proposal = Proposal(
        rfp_id=stub_rfp.id,
        template_id=uuid.UUID(body.template_id) if body.template_id else None,
        mode="DIRECT",
        title=body.title,
    )
    db.add(proposal)
    await db.flush()

    # Same fix: use async function directly, not the Celery wrapper that calls asyncio.run()
    from tasks.proposal_tasks import _generate_sections_async
    background_tasks.add_task(_generate_sections_async, str(proposal.id), str(stub_rfp.id), sections_to_use)

    await log_action(db, current_user.id, "create_direct_proposal", "proposal", str(proposal.id),
                     ip_address=request.client.host if request.client else None)

    await db.commit()
    result = await db.execute(
        select(Proposal).options(selectinload(Proposal.sections)).where(Proposal.id == proposal.id)
    )
    return ProposalResponse.model_validate(result.scalar_one())
