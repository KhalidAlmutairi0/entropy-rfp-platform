"""Celery tasks for proposal section generation."""

import asyncio
import json
from pathlib import Path

import structlog

from core.celery_app import celery_app

logger = structlog.get_logger()

DEFAULT_SECTIONS = [
    {"title_en": "Cover Page", "title_ar": "صفحة الغلاف", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Executive Summary", "title_ar": "الملخص التنفيذي", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Company Profile", "title_ar": "نبذة عن الشركة", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Methodology", "title_ar": "المنهجية", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Technical Approach", "title_ar": "الأسلوب التقني", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Project Plan", "title_ar": "خطة المشروع", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Team & Qualifications", "title_ar": "الفريق والمؤهلات", "is_locked": False, "is_auto_generated": True},
    {"title_en": "Pricing", "title_ar": "التسعير", "is_locked": True, "is_auto_generated": False},
    {"title_en": "Compliance & Certifications", "title_ar": "الامتثال والشهادات", "is_locked": False, "is_auto_generated": True},
]


@celery_app.task(bind=True, name="tasks.proposal_tasks.generate_proposal_sections_task")
def generate_proposal_sections_task(self, proposal_id: str, rfp_id: str, sections_to_use: list | None = None) -> dict:
    return asyncio.run(_generate_sections_async(proposal_id, rfp_id, sections_to_use))


async def _generate_sections_async(proposal_id: str, rfp_id: str, sections_to_use: list | None = None) -> dict:
    from core.database import AsyncSessionLocal
    from models.decision import Decision
    from models.flag import Flag
    from models.proposal import Proposal
    from models.proposal_section import ProposalSection
    from models.rfp import RFP
    from models.template import TemplateSection
    from services.proposal_generator_service import generate_section_content
    from services.storage import StorageService
    from sqlalchemy import delete, select
    from sqlalchemy.orm import selectinload
    from tasks.ingestion_tasks import _extract_text

    storage = StorageService.get_instance()
    company_brief = _load_entropy_brief()

    async with AsyncSessionLocal() as db:
        proposal = (
            await db.execute(
                select(Proposal)
                .options(selectinload(Proposal.rfp).selectinload(RFP.files))
                .where(Proposal.id == proposal_id)
            )
        ).scalar_one_or_none()
        if not proposal:
            return {"error": "Proposal not found"}

        rfp = proposal.rfp
        if not rfp:
            return {"error": "RFP not found for proposal"}

        # Avoid duplicate sections if task is retried/retriggered.
        await db.execute(delete(ProposalSection).where(ProposalSection.proposal_id == proposal.id))
        await db.flush()

        template_sections_map: dict[str, dict] = {}
        if proposal.template_id:
            template_sections = (
                await db.execute(
                    select(TemplateSection)
                    .where(TemplateSection.template_id == proposal.template_id)
                    .order_by(TemplateSection.order_index)
                )
            ).scalars().all()
            template_sections_map = {
                f"{(s.title_ar or '').strip().lower()}::{(s.title_en or '').strip().lower()}": {
                    "ai_instructions": s.ai_instructions,
                    "word_count_target": s.word_count_target,
                }
                for s in template_sections
            }

        decision = (await db.execute(select(Decision).where(Decision.rfp_id == rfp.id))).scalar_one_or_none()
        flags = []
        if decision:
            flags = (
                await db.execute(
                    select(Flag).where(Flag.decision_id == decision.id).order_by(Flag.flag_type, Flag.created_at.desc())
                )
            ).scalars().all()

        rfp_text_blocks: list[str] = []
        source_catalog: list[dict] = [
            {
                "source_id": "BRIEF_ENTROPY",
                "source_type": "CAPABILITY",
                "source_title": "Entropy Company Brief",
                "chunk_text": company_brief[:1200],
                "page_number": None,
            }
        ]
        for file_index, rfp_file in enumerate(rfp.files, start=1):
            try:
                content = await storage.download_file(rfp_file.storage_path)
                extracted = await _extract_text(content, rfp_file.mime_type or "", rfp_file.filename)
            except Exception as exc:
                logger.warning("Failed extracting RFP file text", file=rfp_file.filename, error=str(exc))
                continue
            if not extracted.strip():
                continue
            cleaned = extracted.strip()
            rfp_text_blocks.append(f"=== {rfp_file.filename} ===\n{cleaned[:8000]}")
            source_catalog.append(
                {
                    "source_id": f"RFP_FILE_{file_index}",
                    "source_type": "RFP",
                    "source_title": rfp_file.filename,
                    "chunk_text": cleaned[:1000],
                    "page_number": None,
                }
            )

        if decision:
            decision_text = "\n".join(
                [
                    f"Decision: {decision.decision_type}",
                    f"Total score: {decision.total_score:.1f}",
                    f"Confidence: {decision.confidence:.2f}",
                    decision.explanation_ar or "",
                    decision.explanation_en or "",
                ]
            ).strip()
            if decision_text:
                rfp_text_blocks.append(f"=== Qualification Analysis ===\n{decision_text}")
                source_catalog.append(
                    {
                        "source_id": "QUALIFICATION_DECISION",
                        "source_type": "RFP",
                        "source_title": "Qualification analysis",
                        "chunk_text": decision_text[:1000],
                        "page_number": None,
                    }
                )

        red_flags = [f for f in flags if f.flag_type == "RED"]
        green_flags = [f for f in flags if f.flag_type == "GREEN"]
        if red_flags or green_flags:
            flag_lines = ["=== Qualification Flags ==="]
            for f in red_flags[:10]:
                flag_lines.append(
                    f"RED | {f.title_ar or f.title_en or f.flag_code or 'Risk'} | {f.description_ar or f.description_en or f.evidence_quote or ''}"
                )
            for f in green_flags[:10]:
                flag_lines.append(
                    f"GREEN | {f.title_ar or f.title_en or f.flag_code or 'Signal'} | {f.description_ar or f.description_en or f.evidence_quote or ''}"
                )
            rfp_text_blocks.append("\n".join(flag_lines))

        requirements = _extract_requirement_lines("\n\n".join(rfp_text_blocks))
        rfp_context = _build_rfp_context(rfp, rfp_text_blocks, requirements)

        agenda = sections_to_use if sections_to_use else DEFAULT_SECTIONS
        created = 0
        for idx, section_def in enumerate(agenda):
            is_locked = section_def.get("is_locked", False)
            title_ar = section_def.get("title_ar", "") or ""
            title_en = section_def.get("title_en", "") or ""
            instructions = section_def.get("ai_instructions") or _resolve_template_instructions(
                template_sections_map, title_ar, title_en
            )
            if section_def.get("word_count_target"):
                instructions = f"{instructions or ''}\nTarget word count: {section_def['word_count_target']}".strip()

            if is_locked:
                section = ProposalSection(
                    proposal_id=proposal.id,
                    order_index=idx,
                    title_ar=title_ar,
                    title_en=title_en,
                    is_locked=True,
                    is_ai_generated=False,
                    content_ar=_locked_section_text(title_ar or title_en),
                    content_en="This section is locked for manual completion.",
                    confidence=0.0,
                    has_ungrounded_claims=False,
                    citations_json="[]",
                    word_count=0,
                    generation_prompt_version="proposal-v2",
                )
                db.add(section)
                created += 1
                continue

            generation = await generate_section_content(
                section_title=title_ar or title_en or f"Section {idx + 1}",
                language="ar",
                rfp_context=rfp_context,
                brief_context=company_brief,
                instructions=instructions,
                source_catalog=source_catalog,
            )
            citations_json = json.dumps(generation.get("citations", []), ensure_ascii=False)
            section = ProposalSection(
                proposal_id=proposal.id,
                order_index=idx,
                title_ar=title_ar,
                title_en=title_en,
                is_locked=False,
                is_ai_generated=True,
                content_ar=generation.get("content"),
                content_en=None,
                confidence=generation.get("confidence"),
                has_ungrounded_claims=generation.get("has_ungrounded_claims", False),
                citations_json=citations_json,
                word_count=generation.get("word_count", 0),
                generation_prompt_version="proposal-v2",
            )
            db.add(section)
            created += 1

        await db.commit()
        logger.info("Proposal sections generated", proposal_id=proposal_id, sections=created)
        return {"proposal_id": proposal_id, "sections_created": created}


def _extract_requirement_lines(text: str) -> list[str]:
    requirement_markers = (
        "must",
        "shall",
        "required",
        "requirement",
        "mandatory",
        "should",
        "يلتزم",
        "يجب",
        "متطلب",
        "متطلبات",
        "إلزامي",
        "يشترط",
    )
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if len(line) < 8:
            continue
        lowered = line.lower()
        if any(marker in lowered for marker in requirement_markers):
            lines.append(line)
    return lines[:80]


def _build_rfp_context(rfp, text_blocks: list[str], requirements: list[str]) -> str:
    header_parts = [
        # Fix Bug #5: RFP model has title_ar and title_en; there is no `title` attribute.
        # When both are None, rfp.title raised AttributeError, crashing every proposal generation.
        f"RFP title: {rfp.title_ar or rfp.title_en or 'Untitled RFP'}",
        f"Agency: {rfp.agency or 'N/A'}",
        f"Tender number: {rfp.tender_number or 'N/A'}",
        f"Language: {rfp.language}",
        f"Deadline: {rfp.deadline.isoformat() if rfp.deadline else 'N/A'}",
    ]
    req_block = "\n".join(f"- {r}" for r in requirements) or "- No explicit requirement lines extracted."
    body = "\n\n".join(text_blocks)[:24000]
    return (
        "\n".join(header_parts)
        + "\n\nExtracted requirement lines:\n"
        + req_block
        + "\n\nRFP and analysis context:\n"
        + body
    )


def _resolve_template_instructions(template_map: dict[str, dict], title_ar: str, title_en: str) -> str | None:
    key = f"{title_ar.strip().lower()}::{title_en.strip().lower()}"
    item = template_map.get(key)
    return item.get("ai_instructions") if item else None


def _load_entropy_brief() -> str:
    current = Path(__file__).resolve()
    candidates = [current.parent / "Entropy_Company_Brief.md"]
    for parent in current.parents:
        candidates.append(parent / "Entropy_Company_Brief.md")
    for path in candidates:
        if path.exists():
            return path.read_text(encoding="utf-8", errors="ignore")
    logger.warning("Entropy company brief not found on filesystem")
    return ""


def _locked_section_text(section_title: str) -> str:
    return (
        f"{section_title}\n\n"
        "هذا القسم مخصص للإدخال اليدوي (مثل الأسعار أو البنود التجارية) "
        "ويحتاج مراجعة واعتماد فريق الأعمال قبل التصدير."
    )
