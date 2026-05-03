"""Proposal generation service."""

import re
from collections.abc import AsyncGenerator

import structlog

from core.config import settings

logger = structlog.get_logger()


async def generate_section_content(
    section_title: str,
    language: str,
    rfp_context: str,
    brief_context: str,
    instructions: str | None = None,
    source_catalog: list[dict] | None = None,
) -> dict:
    """Generate a complete section body with citation metadata."""
    source_catalog = source_catalog or []
    system_prompt = _build_system_prompt(language)
    user_prompt = _build_user_prompt(
        section_title=section_title,
        language=language,
        rfp_context=rfp_context,
        brief_context=brief_context,
        instructions=instructions or "",
        source_catalog=source_catalog,
    )

    generated = ""
    try:
        generated = await _complete_text(system_prompt, user_prompt)
    except Exception as exc:
        logger.warning("Section generation failed; using fallback", error=str(exc), section=section_title)

    if not generated.strip():
        generated = _fallback_section_text(section_title, language, rfp_context, brief_context)

    citation_ids = _extract_citation_ids(generated)
    citations = _build_citations(citation_ids, source_catalog)
    has_ungrounded_claims = len(citation_ids) == 0
    confidence = 0.86 if not has_ungrounded_claims else 0.58
    word_count = _word_count(generated)

    return {
        "content": generated.strip(),
        "citations": citations,
        "has_ungrounded_claims": has_ungrounded_claims,
        "confidence": confidence,
        "word_count": word_count,
    }


async def regenerate_section_stream(
    section_id: str,
    instructions: str | None,
    language: str = "ar",
) -> AsyncGenerator[str, None]:
    """Stream free-form section regeneration."""
    system_prompt = _build_system_prompt(language)
    user_prompt = f"Section ID: {section_id}\n\nRegenerate full section content."
    if instructions:
        user_prompt += f"\n\nAdditional instructions:\n{instructions}"

    if settings.llm_provider == "ollama":
        async for chunk in _stream_ollama(system_prompt, user_prompt):
            yield chunk
    else:
        async for chunk in _stream_anthropic(system_prompt, user_prompt):
            yield chunk


def _build_system_prompt(language: str) -> str:
    if language == "ar":
        return (
            "أنت خبير في كتابة العروض الفنية لشركة Entropy في السوق السعودي. "
            "اكتب محتوى احترافياً ومباشراً يستجيب لمتطلبات الجهة. "
            "تجنب الحشو، وقدم نقاط تنفيذ واضحة، وأضف الاستشهادات بهذا الشكل [SOURCE:id] عند الادعاءات."
        )
    return (
        "You are an expert enterprise proposal writer for Entropy in Saudi Arabia. "
        "Write practical, requirement-driven proposal content with a professional tone. "
        "Cite factual claims with inline references using [SOURCE:id]."
    )


def _build_user_prompt(
    section_title: str,
    language: str,
    rfp_context: str,
    brief_context: str,
    instructions: str,
    source_catalog: list[dict],
) -> str:
    source_lines = "\n".join(f"- {s['source_id']}: {s['source_title']}" for s in source_catalog[:20])
    return (
        f"Section title: {section_title}\n"
        f"Language: {language}\n\n"
        "RFP requirements/context:\n"
        f"{rfp_context[:12000]}\n\n"
        "Entropy brief context:\n"
        f"{brief_context[:10000]}\n\n"
        "Available source ids:\n"
        f"{source_lines or '- BRIEF_ENTROPY: Entropy Company Brief'}\n\n"
        f"Additional instructions:\n{instructions or 'N/A'}\n\n"
        "Output requirements:\n"
        "1) Provide complete section content (not an outline).\n"
        "2) Cover scope, delivery approach, governance, and measurable outcomes when relevant.\n"
        "3) Include [SOURCE:id] for factual claims.\n"
        "4) Return plain text only."
    )


def _extract_citation_ids(text: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\[SOURCE:([A-Za-z0-9._:-]+)\]", text)))


def _build_citations(citation_ids: list[str], source_catalog: list[dict]) -> list[dict]:
    source_map = {s["source_id"]: s for s in source_catalog}
    citations = []
    for source_id in citation_ids:
        source = source_map.get(source_id)
        if source:
            citations.append(
                {
                    "source_id": source_id,
                    "source_type": source.get("source_type", "OTHER"),
                    "source_title": source.get("source_title", source_id),
                    "chunk_text": source.get("chunk_text", ""),
                    "page_number": source.get("page_number"),
                }
            )
        else:
            citations.append(
                {
                    "source_id": source_id,
                    "source_type": "OTHER",
                    "source_title": source_id,
                    "chunk_text": "",
                    "page_number": None,
                }
            )
    return citations


def _fallback_section_text(section_title: str, language: str, rfp_context: str, brief_context: str) -> str:
    if language == "ar":
        rfp_excerpt = rfp_context[:1200].strip() or "لا تتوفر متطلبات نصية كافية من وثائق المناقصة."
        brief_excerpt = brief_context[:1200].strip() or "ملخص Entropy غير متاح حالياً."
        return (
            f"{section_title}\n\n"
            "تقدم Entropy هذا القسم بصياغة تنفيذية تركز على تلبية متطلبات الجهة بدقة، "
            "مع اعتماد منهجية واضحة للحوكمة والتنفيذ وإدارة المخاطر وقياس الأثر.\n\n"
            "متطلبات المناقصة ذات الصلة:\n"
            f"{rfp_excerpt}\n\n"
            "مواءمة قدرات Entropy:\n"
            f"{brief_excerpt}\n\n"
            "سيتم تنفيذ العمل عبر مراحل: الاكتشاف، التصميم، التنفيذ، نقل المعرفة، والتشغيل المستدام، "
            "مع مؤشرات أداء قابلة للقياس ومسارات تصعيد واضحة.\n"
            "[SOURCE:RFP_MAIN] [SOURCE:BRIEF_ENTROPY]"
        )
    return (
        f"{section_title}\n\n"
        "Entropy proposes a delivery approach tailored to the RFP priorities, with clear governance, phased execution, "
        "risk controls, and measurable outcomes.\n"
        "The approach aligns with the provided RFP context and Entropy company capabilities.\n"
        "[SOURCE:RFP_MAIN] [SOURCE:BRIEF_ENTROPY]"
    )


def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", re.sub(r"<[^>]+>", " ", text)))


async def _complete_text(system_prompt: str, user_prompt: str) -> str:
    if settings.llm_provider == "ollama":
        return await _complete_ollama(system_prompt, user_prompt)
    return await _complete_anthropic(system_prompt, user_prompt)


async def _complete_anthropic(system_prompt: str, user_prompt: str) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=settings.primary_llm_model,
        max_tokens=1800,
        temperature=0.3,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text_parts = [block.text for block in response.content if hasattr(block, "text")]
    return "".join(text_parts).strip()


async def _stream_anthropic(system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    async with client.messages.stream(
        model=settings.primary_llm_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _complete_ollama(system_prompt: str, user_prompt: str) -> str:
    import httpx

    url = f"{settings.ollama_api_url}/api/chat"
    payload = {
        "model": settings.ollama_llm_model,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
    return data.get("message", {}).get("content", "").strip()


async def _stream_ollama(system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
    import json

    import httpx

    url = f"{settings.ollama_api_url}/api/chat"
    payload = {
        "model": settings.ollama_llm_model,
        "stream": True,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
                if data.get("done"):
                    break
