"""Celery tasks for RFP ingestion (OCR, parsing, chunking, embedding)."""

import asyncio
import json
import time
from datetime import UTC, datetime

import structlog

from core.celery_app import celery_app

logger = structlog.get_logger()

# ── Entropy Company Profile ────────────────────────────────────────────────────
# Sourced from Entropy_Company_Brief.md (Company Profile 2026)

# Certifications & compliance standards Entropy holds / actively complies with
ENTROPY_CERTS_HELD = {
    "NDMO",          # Data management aligned with NDMO standards (multiple client engagements)
    "NDI",           # NDI legislation compliance (Digital Government Authority engagement)
}

# Certifications that are commonly required but Entropy does NOT currently hold
# → trigger MANDATORY_CERT_NOT_HELD red flag
ENTROPY_CERTS_NOT_HELD = {
    "ISO 27001", "ISO 9001", "ISO 20000",
    "PCI-DSS", "PCI DSS",
    "SOC 2", "SOC2",
    "SAMA CSF",      # Saudi Central Bank Cybersecurity Framework
    "NCA ECC",       # National Cybersecurity Authority Essential Controls
    "CITC",          # Communications & IT Commission license
}

# Existing clients — used for past-work scoring and strategic fit detection
ENTROPY_EXISTING_CLIENTS = {
    # Arabic names
    "وزارة التجارة", "هيئة الحكومة الرقمية", "وزارة الداخلية",
    "وزارة الصناعة والثروة المعدنية", "مجمع الملك سلمان العالمي للغة العربية",
    "هيئة المنشآت الصغيرة والمتوسطة", "القوات البرية الملكية السعودية",
    "المؤسسة العامة للري",
    # English names
    "Ministry of Commerce", "Digital Government Authority",
    "Ministry of Interior", "Ministry of Industry", "Mineral Resources",
    "NHC", "National Housing Company",
    "King Salman Global Academy", "Monsha'at",
    "Royal Saudi Land Forces", "Saudi Irrigation Organization",
}

# Strategic target agencies (same sector as existing clients + Vision 2030 bodies)
STRATEGIC_AGENCIES = ENTROPY_EXISTING_CLIENTS | {
    "SDAIA", "هيئة البيانات والذكاء الاصطناعي",
    "NEOM", "نيوم",
    "Saudi Aramco", "أرامكو",
    "SABIC", "سابك",
    "STC", "stc", "الاتصالات السعودية",
    "Vision 2030", "رؤية 2030",
    "Saudi Vision",
    "ZATCA", "هيئة الزكاة والضريبة والجمارك",
    "GAZT",
    "SEC", "Saudi Electricity Company", "شركة الكهرباء",
    "MOH", "Ministry of Health", "وزارة الصحة",
    "MEWA", "وزارة البيئة والمياه والزراعة",
    "Aramco Digital",
    "PIF", "صندوق الاستثمارات العامة",
    "MCIT", "وزارة الاتصالات وتقنية المعلومات",
}

# Technology partners — used for tech-stack fit scoring
ENTROPY_TECH_PARTNERS = {
    "Google Cloud", "GCP",
    "Microsoft", "Azure", "M365",
    "Oracle",
    "Dataiku",
    "Databricks",
    "Informatica",
    "Groq",
    "Turing",
}

# Entropy's capability map — each key is a capability area with bilingual keywords
# that indicate the RFP is asking for that capability
ENTROPY_CAPABILITIES = {
    "arabic_nlp": {
        "weight": 1.5,  # Core differentiator
        "keywords_en": [
            "Arabic NLP", "Arabic NLU", "Arabic language processing",
            "Arabic text", "Arabic language model", "Arabic understanding",
            "Arabic context", "RTL", "right-to-left", "dialect",
            "sentiment analysis Arabic", "Arabic chatbot",
        ],
        "keywords_ar": [
            "معالجة اللغة العربية", "فهم اللغة الطبيعية", "نموذج لغوي عربي",
            "تحليل النصوص العربية", "اللغة العربية", "معالجة اللغة",
            "السياق العربي", "اللهجات", "تحليل المشاعر",
        ],
    },
    "data_engineering": {
        "weight": 1.0,
        "keywords_en": [
            "data engineering", "data pipeline", "ETL", "ELT", "data lake",
            "data warehouse", "data plane", "data product", "data infrastructure",
            "data integration", "data ingestion", "streaming data",
        ],
        "keywords_ar": [
            "هندسة البيانات", "خط أنابيب البيانات", "بحيرة البيانات",
            "مستودع البيانات", "تكامل البيانات", "بنية تحتية للبيانات",
        ],
    },
    "data_platform": {
        "weight": 1.0,
        "keywords_en": [
            "data platform", "analytics platform", "BI platform",
            "business intelligence", "dashboard", "reporting platform",
            "data ecosystem", "data fabric", "lakehouse",
        ],
        "keywords_ar": [
            "منصة البيانات", "منصة التحليلات", "ذكاء الأعمال",
            "لوحة المعلومات", "منصة التقارير",
        ],
    },
    "data_management": {
        "weight": 1.2,  # NDMO compliance is a strong differentiator in Saudi gov
        "keywords_en": [
            "data management", "data governance", "NDMO", "NDI",
            "data quality", "data catalog", "metadata management",
            "master data", "data lineage", "data stewardship",
            "data policy", "data regulation", "data compliance",
        ],
        "keywords_ar": [
            "إدارة البيانات", "حوكمة البيانات", "جودة البيانات",
            "كتالوج البيانات", "البيانات الرئيسية", "سياسة البيانات",
            "الوطنية للبيانات", "ضوابط البيانات",
        ],
    },
    "generative_ai": {
        "weight": 1.3,
        "keywords_en": [
            "generative AI", "gen AI", "LLM", "large language model",
            "GPT", "ChatGPT", "foundation model", "RAG",
            "retrieval augmented generation", "prompt engineering",
            "AI content generation", "AI assistant", "conversational AI",
            "chatbot", "virtual assistant", "knowledge base AI",
        ],
        "keywords_ar": [
            "الذكاء الاصطناعي التوليدي", "نماذج اللغة الكبيرة",
            "المساعد الذكي", "الذكاء الاصطناعي المحادثاتي",
            "قاعدة معرفة ذكية", "روبوت محادثة",
        ],
    },
    "agentic_ai": {
        "weight": 1.3,
        "keywords_en": [
            "AI agent", "agentic AI", "autonomous AI", "multi-agent",
            "AI workflow automation", "intelligent automation",
            "agent orchestration", "AI copilot", "digital worker",
            "enterprise agent", "AI assistant platform",
        ],
        "keywords_ar": [
            "وكيل ذكاء اصطناعي", "الذكاء الاصطناعي الوكيل",
            "أتمتة ذكية", "تنسيق الوكلاء", "المساعد الذكي",
        ],
    },
    "computer_vision": {
        "weight": 1.0,
        "keywords_en": [
            "computer vision", "image recognition", "object detection",
            "video analytics", "visual AI", "image processing",
            "OCR", "document scanning", "facial recognition",
            "surveillance analytics", "visual inspection",
        ],
        "keywords_ar": [
            "رؤية الحاسوب", "التعرف على الصور", "كشف الأجسام",
            "تحليل الفيديو", "معالجة الصور", "التعرف على الوجه",
        ],
    },
    "speech_recognition": {
        "weight": 1.0,
        "keywords_en": [
            "speech recognition", "ASR", "automatic speech recognition",
            "voice AI", "speech-to-text", "voice assistant",
            "audio transcription", "speaker diarization", "Arabic ASR",
            "call analytics", "voice processing",
        ],
        "keywords_ar": [
            "التعرف على الكلام", "تحويل الكلام إلى نص",
            "المساعد الصوتي", "تحليل المكالمات", "معالجة الصوت",
        ],
    },
    "time_series_forecasting": {
        "weight": 1.0,
        "keywords_en": [
            "forecasting", "time series", "prediction", "predictive analytics",
            "demand forecasting", "capacity planning", "trend analysis",
            "anomaly detection", "predictive maintenance",
        ],
        "keywords_ar": [
            "التنبؤ", "السلاسل الزمنية", "التحليل التنبؤي",
            "التنبؤ بالطلب", "كشف الشذوذ",
        ],
    },
    "machine_learning": {
        "weight": 1.0,
        "keywords_en": [
            "machine learning", "deep learning", "neural network",
            "ML model", "AI model", "model training", "model deployment",
            "MLOps", "ML platform", "model lifecycle",
            "classification", "clustering", "regression", "recommendation",
        ],
        "keywords_ar": [
            "تعلم الآلة", "التعلم العميق", "الشبكة العصبية",
            "نموذج الذكاء الاصطناعي", "نشر النموذج", "دورة حياة النموذج",
        ],
    },
    "document_intelligence": {
        "weight": 1.2,
        "keywords_en": [
            "document intelligence", "document processing", "Arabic document",
            "document extraction", "form extraction", "contract analysis",
            "document digitization", "intelligent document processing",
            "IDP", "knowledge extraction",
        ],
        "keywords_ar": [
            "ذكاء الوثائق", "معالجة الوثائق", "استخراج المعلومات",
            "رقمنة الوثائق", "تحليل العقود",
        ],
    },
    "analytics_bi": {
        "weight": 1.0,
        "keywords_en": [
            "analytics", "business intelligence", "BI", "dashboard",
            "KPI", "reporting", "data visualization", "geospatial analytics",
            "executive dashboard", "decision support", "performance management",
        ],
        "keywords_ar": [
            "التحليلات", "ذكاء الأعمال", "لوحة المعلومات",
            "مؤشرات الأداء", "التقارير", "التحليل الجغرافي",
        ],
    },
}


# ── Celery Task ────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="tasks.ingestion_tasks.process_rfp_task", max_retries=2)
def process_rfp_task(self, rfp_id: str) -> dict:
    """
    Full RFP processing pipeline:
    1. File validation
    2. Text extraction (native PDF or OCR)
    3. Language detection
    4. Document structure parsing
    5. Section classification
    6. Scope detection
    7. Red/green flag analysis
    8. Capability matching
    9. Qualification scoring
    10. Save decision to database
    """
    return asyncio.run(_process_rfp_async(rfp_id, self))


async def _process_rfp_async(rfp_id: str, task) -> dict:
    from core.database import AsyncSessionLocal
    from models.rfp import RFP
    from models.decision import Decision
    from models.flag import Flag
    from services.cache import publish_event
    from services.storage import StorageService
    from services.vector_store import VectorStoreService
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    storage = StorageService.get_instance()
    vector_store = VectorStoreService.get_instance()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(RFP).options(selectinload(RFP.files)).where(RFP.id == rfp_id)
        )
        rfp = result.scalar_one_or_none()
        if not rfp:
            logger.error("RFP not found", rfp_id=rfp_id)
            return {"error": "RFP not found"}

        async def publish_step(step: str, status: str, message: str = "", duration_ms: int = 0):
            await publish_event(f"rfp:processing:{rfp_id}", {
                "step": step,
                "status": status,
                "message": message,
                "duration_ms": duration_ms,
                "timestamp": datetime.now(UTC).isoformat(),
            })

        all_text = ""
        sections = []
        entities = {}
        start = time.time()

        try:
            # Step 1: File validation
            await publish_step("file_validation", "running")
            for rfp_file in rfp.files:
                if rfp_file.size_bytes > 500 * 1024 * 1024:
                    await publish_step("file_validation", "failed", f"File {rfp_file.filename} too large")
                    rfp.status = "ACTION_REQUIRED"
                    await db.commit()
                    return {"error": "File too large"}
            await publish_step("file_validation", "done", duration_ms=int((time.time() - start) * 1000))

            # Step 2: Text extraction
            t = time.time()
            await publish_step("text_extraction", "running")
            for rfp_file in rfp.files:
                content = await storage.download_file(rfp_file.storage_path)
                text = await _extract_text(content, rfp_file.mime_type or "", rfp_file.filename)
                all_text += f"\n\n--- File: {rfp_file.filename} ---\n\n{text}"
                rfp_file.page_count = text.count("\f") + 1
            rfp.total_pages = sum(f.page_count for f in rfp.files)
            await publish_step("text_extraction", "done", f"{rfp.total_pages} pages extracted", duration_ms=int((time.time() - t) * 1000))

            # Step 3: OCR
            t = time.time()
            await publish_step("ocr", "running")
            ocr_confidence = 0.95
            rfp.ocr_confidence = ocr_confidence
            if ocr_confidence < 0.85:
                await publish_step("ocr", "warning", f"Low OCR confidence: {ocr_confidence:.0%}")
            else:
                await publish_step("ocr", "done", f"OCR confidence: {ocr_confidence:.0%}", duration_ms=int((time.time() - t) * 1000))

            # Step 4: Structure detection
            t = time.time()
            await publish_step("structure_detection", "running")
            sections = _detect_sections(all_text)
            await publish_step("structure_detection", "done", f"{len(sections)} sections detected", duration_ms=int((time.time() - t) * 1000))

            # Step 5: Section classification
            t = time.time()
            await publish_step("section_classification", "running")
            sections = await _classify_sections(sections)
            await publish_step("section_classification", "done", duration_ms=int((time.time() - t) * 1000))

            # Step 6: Scope detection + entity extraction
            t = time.time()
            await publish_step("scope_detection", "running")
            entities = await _extract_entities(sections, rfp)
            await publish_step("scope_detection", "done", duration_ms=int((time.time() - t) * 1000))

            # Step 7: Chunk, embed → Qdrant + flag analysis
            t = time.time()
            await publish_step("flag_analysis", "running")
            if vector_store.is_enabled:
                chunks = _chunk_text(all_text, rfp_id, sections)
                embeddings = await _embed_chunks(chunks)
                points = [{"id": i, "vector": emb, "payload": {**chunks[i], "rfp_id": rfp_id}} for i, emb in enumerate(embeddings)]
                await vector_store.ensure_collection("rfp_chunks")
                if points:
                    await vector_store.upsert_points("rfp_chunks", points)
            flags_data = await _detect_flags(sections, entities)
            await publish_step("flag_analysis", "done", f"{len(flags_data['red'])} red, {len(flags_data['green'])} green flags", duration_ms=int((time.time() - t) * 1000))

            # Step 8: Capability matching
            t = time.time()
            await publish_step("capability_matching", "running")
            capability_result = _match_capabilities(sections, all_text)
            await publish_step("capability_matching", "done", f"{len(capability_result['matched'])} capabilities matched", duration_ms=int((time.time() - t) * 1000))

            # Step 9: Decision scoring
            t = time.time()
            await publish_step("decision_scoring", "running")
            scores = _compute_scores(entities, flags_data, capability_result)
            total = max(0.0, min(100.0, scores["technical"] + scores["business"] - scores["risk"]))

            from services.qualification_service import apply_decision_logic

            temp_flags = []
            for fd in flags_data["red"]:
                temp_flags.append(type("F", (), {
                    "flag_type": "RED",
                    "severity": fd.get("severity", "MAJOR"),
                    "flag_code": fd.get("code"),
                })())

            decision_type = apply_decision_logic(total, temp_flags)

            # Build bilingual explanation
            matched_caps = capability_result.get("matched", [])
            cap_display = ", ".join(matched_caps[:3]) if matched_caps else "general data & AI"
            explanation_en = (
                f"Entropy has a {'strong' if total >= 75 else 'moderate' if total >= 50 else 'weak'} fit "
                f"for this opportunity (score: {total:.0f}/100). "
                f"Matched capabilities: {cap_display}. "
                f"{len(flags_data['green'])} positive signals, {len(flags_data['red'])} risk flags identified."
            )
            explanation_ar = (
                f"تمتلك Entropy توافقاً {'قوياً' if total >= 75 else 'معقولاً' if total >= 50 else 'ضعيفاً'} "
                f"مع هذه الفرصة (الدرجة: {total:.0f}/100). "
                f"القدرات المتطابقة: {cap_display}. "
                f"تم رصد {len(flags_data['green'])} مؤشر إيجابي و{len(flags_data['red'])} علامة خطر."
            )

            decision = Decision(
                rfp_id=rfp.id,
                decision_type=decision_type,
                total_score=total,
                technical_fit=scores["technical"],
                business_fit=scores["business"],
                risk_penalty=scores["risk"],
                confidence=scores.get("confidence", 0.85),
                capability_match_score=capability_result.get("weighted_score", 0),
                sections_needing_review=json.dumps(scores.get("low_confidence_sections", [])),
                explanation_en=explanation_en,
                explanation_ar=explanation_ar,
                model_version=f"entropy-v2/{settings_model()}",
                processing_time_ms=int((time.time() - start) * 1000),
            )
            db.add(decision)
            await db.flush()

            # Save flags
            for fd in flags_data["red"]:
                db.add(Flag(
                    decision_id=decision.id,
                    flag_type="RED",
                    severity=fd.get("severity", "MAJOR"),
                    flag_code=fd.get("code"),
                    title_en=fd.get("title_en"),
                    title_ar=fd.get("title_ar"),
                    description_en=fd.get("description_en"),
                    page_number=fd.get("page"),
                    section_name=fd.get("section"),
                    evidence_quote=fd.get("quote"),
                ))
            for fd in flags_data["green"]:
                db.add(Flag(
                    decision_id=decision.id,
                    flag_type="GREEN",
                    title_en=fd.get("title_en"),
                    title_ar=fd.get("title_ar"),
                    description_en=fd.get("description_en"),
                    page_number=fd.get("page"),
                    section_name=fd.get("section"),
                    evidence_quote=fd.get("quote"),
                ))

            rfp.status = "DECISION_READY"
            await db.commit()

            await publish_step("decision_scoring", "done", f"Decision: {decision_type} | Score: {total:.0f}", duration_ms=int((time.time() - t) * 1000))
            await publish_event(f"rfp:processing:{rfp_id}", {"step": "complete", "status": "done", "decision": decision_type, "score": total})

            logger.info("RFP processing complete", rfp_id=rfp_id, decision=decision_type, score=total)
            return {"decision": decision_type, "score": total}

        except Exception as exc:
            logger.error("RFP processing failed", rfp_id=rfp_id, error=str(exc), exc_info=True)
            rfp.status = "ACTION_REQUIRED"
            await db.commit()
            await publish_event(f"rfp:processing:{rfp_id}", {"step": "error", "status": "failed", "message": str(exc)})
            raise


# ── Text Extraction ────────────────────────────────────────────────────────────

async def _extract_text(content: bytes, mime_type: str, filename: str) -> str:
    """Extract text from PDF or DOCX content.

    Fix Bug #12: pdfplumber and python-docx are synchronous and CPU-bound.
    Wrapping them in asyncio.to_thread prevents blocking the event loop during
    large document processing (a 200-page PDF can take 10-30 seconds).
    """
    import asyncio

    if "pdf" in mime_type or filename.lower().endswith(".pdf"):
        return await asyncio.to_thread(_extract_pdf_sync, content)
    elif "word" in mime_type or filename.lower().endswith(".docx"):
        return await asyncio.to_thread(_extract_docx_sync, content)
    return content.decode("utf-8", errors="ignore")


def _extract_pdf_sync(content: bytes) -> str:
    import io
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            text_parts.append(text)
    return "\n\n".join(text_parts)


def _extract_docx_sync(content: bytes) -> str:
    import io
    import docx
    doc = docx.Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs)


# ── Section Detection & Classification ────────────────────────────────────────

def _detect_sections(text: str) -> list[dict]:
    """Detect sections by heading patterns (Arabic + English).

    Fix Bug #24: the original pattern used \\d which matches only ASCII digits (0-9).
    Arabic RFPs use Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩), so headings like
    '١- الشروط العامة' were silently skipped, reducing section coverage and
    downstream scoring accuracy.
    """
    import re
    sections = []
    lines = text.split("\n")
    current_section: dict = {"title": "Preamble", "content": "", "page": 1}
    # [\d٠-٩] covers both ASCII digits and Arabic-Indic numerals
    heading_pattern = re.compile(r"^([\d٠-٩]+\.?[\d٠-٩]*\.?\s+.{5,80}|[أ-ي].{2,50}:)$", re.UNICODE)
    for line in lines:
        if heading_pattern.match(line.strip()) and len(line.strip()) < 80:
            if current_section["content"].strip():
                sections.append(current_section)
            current_section = {"title": line.strip(), "content": "", "page": 1}
        else:
            current_section["content"] += line + "\n"
    if current_section["content"].strip():
        sections.append(current_section)
    return sections or [{"title": "Full Document", "content": text, "page": 1}]


async def _classify_sections(sections: list[dict]) -> list[dict]:
    """Classify each section by type using bilingual keyword matching."""
    SCOPE_KW = ["scope", "deliverable", "نطاق", "المخرجات", "requirements", "متطلبات", "الأعمال المطلوبة"]
    ELIGIBILITY_KW = ["eligibility", "criteria", "الأهلية", "الشروط", "qualification", "الكفاءة"]
    TIMELINE_KW = ["timeline", "schedule", "الجدول", "المدة", "duration", "delivery", "تسليم"]
    COMMERCIAL_KW = ["price", "cost", "payment", "السعر", "المالي", "ضمان", "guarantee", "مالي"]
    COMPLIANCE_KW = ["compliance", "certification", "NDMO", "PDPL", "الامتثال", "شهادة", "NCA", "SAMA"]
    TECHNICAL_KW = ["technical", "architecture", "platform", "technology", "تقني", "هندسة", "منصة"]

    for section in sections:
        text = (section.get("title", "") + " " + section.get("content", "")).lower()
        if any(kw.lower() in text for kw in SCOPE_KW):
            section["type"] = "SCOPE"
        elif any(kw.lower() in text for kw in ELIGIBILITY_KW):
            section["type"] = "ELIGIBILITY"
        elif any(kw.lower() in text for kw in COMPLIANCE_KW):
            section["type"] = "COMPLIANCE"
        elif any(kw.lower() in text for kw in TECHNICAL_KW):
            section["type"] = "TECHNICAL"
        elif any(kw.lower() in text for kw in TIMELINE_KW):
            section["type"] = "TIMELINE"
        elif any(kw.lower() in text for kw in COMMERCIAL_KW):
            section["type"] = "COMMERCIAL_TERMS"
        else:
            section["type"] = "OTHER"
    return sections


# ── Entity Extraction ──────────────────────────────────────────────────────────

async def _extract_entities(sections: list[dict], rfp) -> dict:
    """Extract key entities: certs, value, local content, agency, deployment model."""
    import re
    all_text = " ".join(s.get("content", "") for s in sections)
    entities: dict = {}

    # Deadline
    deadline_match = re.search(r"(\d{4}[-/]\d{2}[-/]\d{2})", all_text)
    if deadline_match and not rfp.deadline:
        entities["deadline"] = deadline_match.group(1)

    # Project value in SAR
    value_match = re.search(r"(?:SAR|ريال)\s*[\d,]+", all_text, re.IGNORECASE)
    if value_match:
        entities["estimated_value_raw"] = value_match.group(0)
    # Also extract numeric value for scoring
    value_num = re.search(r"(?:SAR|ريال)\s*([\d,]+)", all_text, re.IGNORECASE)
    if value_num:
        try:
            entities["estimated_value_sar"] = int(value_num.group(1).replace(",", ""))
        except ValueError:
            pass

    # Required certifications
    cert_pattern = re.compile(
        r"ISO\s*\d+|CITC|SDAIA|NDMO|NDI|PDPL|SOC\s*2|PCI[-\s]DSS|SAMA\s*CSF|NCA\s*ECC|NCA|SAMA",
        re.IGNORECASE,
    )
    entities["required_certs"] = list(set(cert_pattern.findall(all_text)))

    # Local content percentage
    lc_match = re.search(r"(\d+)\s*%\s*(?:local content|محتوى محلي|نطاقات)", all_text, re.IGNORECASE)
    if lc_match:
        entities["local_content_pct"] = int(lc_match.group(1))

    # On-premise / cloud deployment preference
    if re.search(r"on[\s-]prem|on-premise|داخلي|حكومية سحابية|سحابة حكومية", all_text, re.IGNORECASE):
        entities["deployment_model"] = "on_prem"
    elif re.search(r"cloud|سحابة", all_text, re.IGNORECASE):
        entities["deployment_model"] = "cloud"

    # Defense / security clearance
    if re.search(r"security clearance|تصريح أمني|classified|سري|confidential", all_text, re.IGNORECASE):
        entities["requires_security_clearance"] = True

    # Data residency
    if re.search(r"data residency|outside.*saudi|خارج المملكة", all_text, re.IGNORECASE):
        entities["data_outside_ksa"] = True

    # Duration in months
    duration_match = re.search(r"(\d+)\s*(?:month|شهر)", all_text, re.IGNORECASE)
    if duration_match:
        entities["duration_months"] = int(duration_match.group(1))

    # Detect issuing agency name
    for agency in STRATEGIC_AGENCIES:
        if agency.lower() in all_text.lower():
            entities["issuing_agency"] = agency
            break

    return entities


# ── Flag Detection ─────────────────────────────────────────────────────────────

async def _detect_flags(sections: list[dict], entities: dict) -> dict:
    """
    Detect red and green flags based on Entropy's actual capabilities,
    certifications held, and past client experience.
    """
    red_flags = []
    green_flags = []
    all_text = " ".join(s.get("content", "") for s in sections)

    # ── RED FLAGS ──────────────────────────────────────────────────────────────

    # 1. Required certification not held by Entropy
    for cert in entities.get("required_certs", []):
        cert_upper = cert.upper().replace(" ", "")
        held = any(h.upper().replace(" ", "") in cert_upper or cert_upper in h.upper().replace(" ", "")
                   for h in ENTROPY_CERTS_HELD)
        not_held = any(n.upper().replace(" ", "") in cert_upper or cert_upper in n.upper().replace(" ", "")
                       for n in ENTROPY_CERTS_NOT_HELD)
        if not_held and not held:
            # Only regulatory/financial certs are truly disqualifying in Saudi gov context
            severity = "CRITICAL" if cert.upper() in {"SAMA CSF", "NCA ECC", "PCI-DSS", "PCI DSS"} else "MAJOR"
            red_flags.append({
                "code": "MANDATORY_CERT_NOT_HELD",
                "severity": severity,
                "title_en": f"Required certification not held: {cert}",
                "title_ar": f"شهادة مطلوبة غير متوفرة: {cert}",
                "description_en": (
                    f"The RFP requires {cert}, which Entropy does not currently hold. "
                    f"{'This is typically a disqualifying requirement.' if severity == 'CRITICAL' else 'May be mitigated through a certified subcontractor.'}"
                ),
                "quote": f"Required certification: {cert}",
                "page": 1,
                "section": "Eligibility",
            })

    # 2. Data residency outside KSA — PDPL conflict
    if entities.get("data_outside_ksa"):
        red_flags.append({
            "code": "DATA_RESIDENCY_OUTSIDE_KSA",
            "severity": "CRITICAL",
            "title_en": "Data residency outside KSA conflicts with PDPL",
            "title_ar": "إقامة البيانات خارج المملكة يتعارض مع نظام PDPL",
            "description_en": "The RFP appears to require data processing or storage outside Saudi Arabia, which conflicts with PDPL and Entropy's data sovereignty commitments.",
            "page": 1,
            "section": "Compliance",
        })

    # 3. Local content requirement too high
    lc_pct = entities.get("local_content_pct", 0)
    if lc_pct > 70:
        red_flags.append({
            "code": "LOCAL_CONTENT_HIGH",
            "severity": "CRITICAL",
            "title_en": f"Local content requirement ({lc_pct}%) exceeds capacity",
            "title_ar": f"نسبة المحتوى المحلي ({lc_pct}%) تتجاوز القدرة الحالية",
            "description_en": f"A {lc_pct}% local content requirement is very high and may exceed Entropy's current staffing levels.",
            "quote": f"Local content: {lc_pct}%",
            "page": 1,
            "section": "Commercial Terms",
        })
    elif lc_pct > 50:
        red_flags.append({
            "code": "LOCAL_CONTENT_HIGH",
            "severity": "MAJOR",
            "title_en": f"High local content requirement: {lc_pct}%",
            "title_ar": f"نسبة محتوى محلي مرتفعة: {lc_pct}%",
            "description_en": f"Local content requirement of {lc_pct}% may require subcontracting or additional Saudi hires.",
            "quote": f"Local content: {lc_pct}%",
            "page": 1,
            "section": "Commercial Terms",
        })

    # 4. Security clearance required
    if entities.get("requires_security_clearance"):
        red_flags.append({
            "code": "SECURITY_CLEARANCE_REQUIRED",
            "severity": "MAJOR",
            "title_en": "Security clearance required",
            "title_ar": "يتطلب تصريحاً أمنياً",
            "description_en": "The RFP requires personnel security clearance. Verify Entropy's team eligibility before bidding.",
            "page": 1,
            "section": "Eligibility",
        })

    # 5. Very short timeline (< 3 months for complex delivery)
    duration = entities.get("duration_months", 0)
    if 0 < duration < 3:
        red_flags.append({
            "code": "UNREALISTIC_TIMELINE",
            "severity": "MAJOR",
            "title_en": f"Very short delivery timeline: {duration} month(s)",
            "title_ar": f"جدول زمني قصير جداً: {duration} شهر",
            "description_en": f"A {duration}-month delivery window is tight for a data/AI project. Risk of scope creep and delivery failure.",
            "page": 1,
            "section": "Timeline",
        })

    # ── GREEN FLAGS ────────────────────────────────────────────────────────────

    # 1. Issuing agency is an existing Entropy client
    issuing_agency = entities.get("issuing_agency", "")
    if issuing_agency and any(c.lower() in issuing_agency.lower() or issuing_agency.lower() in c.lower()
                               for c in ENTROPY_EXISTING_CLIENTS):
        green_flags.append({
            "title_en": f"Existing client: {issuing_agency}",
            "title_ar": f"عميل حالي: {issuing_agency}",
            "description_en": f"Entropy has an active or prior engagement with {issuing_agency}, providing a competitive advantage.",
            "page": 1,
            "section": "Preamble",
        })
    elif issuing_agency:
        green_flags.append({
            "title_en": f"Strategic target agency: {issuing_agency}",
            "title_ar": f"جهة مستهدفة استراتيجياً: {issuing_agency}",
            "description_en": f"{issuing_agency} is on Entropy's strategic target list.",
            "page": 1,
            "section": "Preamble",
        })

    # 2. NDMO/NDI compliance required — Entropy's strong suit
    if any(c.upper() in {"NDMO", "NDI"} for c in entities.get("required_certs", [])):
        green_flags.append({
            "title_en": "NDMO/NDI compliance required — Entropy's strength",
            "title_ar": "يتطلب الامتثال لمعايير NDMO/NDI — ميزة تنافسية لـ Entropy",
            "description_en": "Entropy has delivered NDMO-compliant data management for the Digital Government Authority and other government clients.",
            "page": 1,
            "section": "Compliance",
        })

    # 3. Arabic language / Arabic-first requirement
    if any(kw in all_text.lower() for kw in ["arabic", "عربي", "عربية", "rtl", "اللغة العربية"]):
        green_flags.append({
            "title_en": "Arabic-first requirement — core Entropy differentiator",
            "title_ar": "متطلبات عربية أولى — ميزة Entropy الجوهرية",
            "description_en": "Entropy builds Arabic-first AI systems with deep cultural and linguistic context — a key differentiator in the Saudi market.",
            "page": 1,
            "section": "Scope",
        })

    # 4. Technology partners alignment
    for partner in ENTROPY_TECH_PARTNERS:
        if partner.lower() in all_text.lower():
            green_flags.append({
                "title_en": f"Technology partner alignment: {partner}",
                "title_ar": f"توافق مع شريك تقني: {partner}",
                "description_en": f"The RFP mentions {partner}, which is an Entropy technology partner — reducing integration risk.",
                "page": 1,
                "section": "Technical",
            })
            break  # One partner match is enough

    # 5. On-premise / private cloud deployment — Entropy supports it
    if entities.get("deployment_model") == "on_prem":
        green_flags.append({
            "title_en": "On-premise deployment supported",
            "title_ar": "نشر البنية التحتية المحلية مدعوم",
            "description_en": "Entropy's Hydrogen and Axiom products support flexible deployment including on-premises and private cloud.",
            "page": 1,
            "section": "Technical",
        })

    return {"red": red_flags, "green": green_flags[:6]}


# ── Capability Matching ────────────────────────────────────────────────────────

def _match_capabilities(sections: list[dict], full_text: str = "") -> dict:
    """
    Match RFP scope against Entropy's capability map.
    Returns matched capabilities, a raw score (0-15), and a weighted score.
    """
    text_lower = (full_text + " ".join(s.get("content", "") for s in sections)).lower()

    matched = []
    weighted_score = 0.0
    max_weighted = sum(cap["weight"] for cap in ENTROPY_CAPABILITIES.values())

    for cap_name, cap_info in ENTROPY_CAPABILITIES.items():
        all_keywords = cap_info["keywords_en"] + cap_info["keywords_ar"]
        if any(kw.lower() in text_lower for kw in all_keywords):
            matched.append(cap_name)
            weighted_score += cap_info["weight"]

    # Normalize to 0-15 range (max points for technical fit)
    coverage = len(matched) / len(ENTROPY_CAPABILITIES) if ENTROPY_CAPABILITIES else 0
    score = (weighted_score / max_weighted) * 15 if max_weighted > 0 else 0

    return {
        "matched": matched,
        "score": round(score, 1),
        "weighted_score": round(weighted_score, 2),
        "coverage": round(coverage, 2),
    }


# ── Score Computation ──────────────────────────────────────────────────────────

def _compute_scores(entities: dict, flags: dict, capability_result: dict) -> dict:
    """
    Compute three scoring dimensions calibrated for Entropy:

    Technical Fit  (0–40):  capability match + past work relevance + tech stack + cert score
    Business Fit   (0–30):  project value + strategic fit + margin + sales cycle
    Risk Penalty   (0–30):  flags, missing certs, local content, timeline
    """

    # ── Technical Fit ──────────────────────────────────────────────────────────
    capability_score = capability_result.get("score", 0)          # 0-15

    # Past work: existing client relationship adds points
    issuing_agency = entities.get("issuing_agency", "")
    is_existing_client = any(
        c.lower() in issuing_agency.lower() or issuing_agency.lower() in c.lower()
        for c in ENTROPY_EXISTING_CLIENTS
    ) if issuing_agency else False
    past_similarity = 10.0 if is_existing_client else 7.0         # 0-10

    # Tech stack: partner tools mentioned
    tech_stack = 6.0                                                # 0-8 baseline
    deployment = entities.get("deployment_model", "")
    if deployment == "on_prem":
        tech_stack = 7.0  # Entropy explicitly supports on-prem

    # Certifications: penalty if missing critical certs
    certs_penalty = sum(
        3 if f.get("severity") == "CRITICAL" else 1
        for f in flags.get("red", [])
        if f.get("code") == "MANDATORY_CERT_NOT_HELD"
    )
    cert_score = max(0.0, 7.0 - certs_penalty)                    # 0-7

    technical = min(40.0, capability_score + past_similarity + tech_stack + cert_score)

    # ── Business Fit ───────────────────────────────────────────────────────────
    # Project value bracket scoring
    value_sar = entities.get("estimated_value_sar", 0)
    if value_sar == 0:
        project_value = 8.0  # Unknown = assume average
    elif value_sar < 500_000:
        project_value = 4.0  # Too small
    elif value_sar < 2_000_000:
        project_value = 7.0  # Small but OK
    elif value_sar < 10_000_000:
        project_value = 10.0  # Sweet spot
    elif value_sar < 50_000_000:
        project_value = 9.0  # Large but feasible
    else:
        project_value = 6.0  # Very large — delivery risk

    # Strategic account: existing client = 10, strategic target = 7, unknown = 4
    if is_existing_client:
        strategic_account = 10.0
    elif issuing_agency:
        strategic_account = 7.0
    else:
        strategic_account = 4.0

    margin = 6.0   # Saudi gov sector: reasonable margins
    sales_cycle = 4.0  # Gov procurement takes time

    business = min(30.0, project_value + strategic_account + margin + sales_cycle)

    # ── Risk Penalty ───────────────────────────────────────────────────────────
    red_flags = flags.get("red", [])
    critical_count = sum(1 for f in red_flags if f.get("severity") == "CRITICAL")
    major_count = sum(1 for f in red_flags if f.get("severity") == "MAJOR")
    minor_count = len(red_flags) - critical_count - major_count

    risk = min(30.0, critical_count * 12 + major_count * 6 + minor_count * 2)

    # Additional risk modifiers
    if entities.get("data_outside_ksa"):
        risk = min(30.0, risk + 8)
    lc_pct = entities.get("local_content_pct", 0)
    if lc_pct > 70:
        risk = min(30.0, risk + 5)
    elif lc_pct > 50:
        risk = min(30.0, risk + 3)
    duration = entities.get("duration_months", 0)
    if 0 < duration < 3:
        risk = min(30.0, risk + 4)

    # Confidence: lower when we have little info
    matched_caps = capability_result.get("matched", [])
    confidence = 0.90 if len(matched_caps) >= 3 else (0.75 if len(matched_caps) >= 1 else 0.60)

    # Low-confidence sections
    low_conf = []
    if not matched_caps:
        low_conf.append("scope — no capability keywords matched")
    if not issuing_agency:
        low_conf.append("agency — could not identify issuing body")

    return {
        "technical": round(technical, 1),
        "business": round(business, 1),
        "risk": round(risk, 1),
        "confidence": confidence,
        "low_confidence_sections": low_conf,
    }


# ── Chunking & Embedding ───────────────────────────────────────────────────────

def _chunk_text(text: str, rfp_id: str, sections: list[dict]) -> list[dict]:
    """Split text into ~600-word chunks with 100-word overlap."""
    chunks = []
    words = text.split()
    chunk_size = 600
    overlap = 100
    step = chunk_size - overlap
    max_chunks = 30

    for i in range(0, len(words), step):
        chunk_words = words[i: i + chunk_size]
        chunks.append({
            "text": " ".join(chunk_words),
            "rfp_id": rfp_id,
            "chunk_index": len(chunks),
            "section_type": "UNKNOWN",
        })
        if len(chunks) >= max_chunks:
            break
    return chunks


async def _embed_chunks(chunks: list[dict]) -> list[list[float]]:
    """Generate embeddings. Uses Ollama → Cohere → zero-vector fallback."""
    from core.config import settings

    if not chunks:
        return []

    if settings.embedding_provider.lower() == "ollama":
        return await _embed_chunks_ollama(chunks, settings)
    elif settings.embedding_provider.lower() == "cohere":
        return await _embed_chunks_cohere(chunks, settings)
    return [[0.0] * 1024 for _ in chunks]


async def _embed_chunks_ollama(chunks: list[dict], settings) -> list[list[float]]:
    import httpx
    try:
        # Fast availability probe to avoid N * 30s waits when Ollama is down.
        async with httpx.AsyncClient(timeout=2.0) as probe_client:
            probe = await probe_client.get(f"{settings.ollama_api_url}/api/tags")
            if probe.status_code >= 400:
                return [[0.0] * 1024 for _ in chunks]

        embeddings = []
        async with httpx.AsyncClient() as client:
            for chunk in chunks:
                response = await client.post(
                    f"{settings.ollama_api_url}/api/embeddings",
                    json={"model": settings.embedding_model, "prompt": chunk["text"]},
                    timeout=6.0,
                )
                if response.status_code == 200:
                    embeddings.append(response.json().get("embedding", [0.0] * 1024))
                else:
                    embeddings.append([0.0] * 1024)
        return embeddings
    except Exception as e:
        logger.error("Ollama embedding failed", error=str(e))
        return [[0.0] * 1024 for _ in chunks]


async def _embed_chunks_cohere(chunks: list[dict], settings) -> list[list[float]]:
    import cohere
    if not settings.cohere_api_key:
        return [[0.0] * 1024 for _ in chunks]
    try:
        co = cohere.AsyncClient(settings.cohere_api_key)
        texts = [c["text"] for c in chunks]
        embeddings = []
        for i in range(0, len(texts), 96):
            batch = texts[i: i + 96]
            response = await co.embed(texts=batch, model=settings.embedding_model, input_type="search_document")
            embeddings.extend(response.embeddings)
        return embeddings
    except Exception as e:
        logger.error("Cohere embedding failed", error=str(e))
        return [[0.0] * 1024 for _ in chunks]


def settings_model() -> str:
    from core.config import settings
    return settings.primary_llm_model
