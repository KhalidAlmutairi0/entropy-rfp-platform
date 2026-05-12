"""
Seed script — creates admin user + proposal templates for local development.
Run from apps/api/: python seed.py
"""

import asyncio
from core.database import AsyncSessionLocal, engine, Base
from models.user import User
from models.template import Template, TemplateSection
import bcrypt as _bcrypt


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


TEMPLATES = [
    {
        "name_ar": "قالب مقترح خدمات الذكاء الاصطناعي",
        "name_en": "AI Services Proposal Template",
        "description_ar": "قالب شامل لمقترحات خدمات الذكاء الاصطناعي وتعلم الآلة للقطاع الحكومي",
        "description_en": "Comprehensive template for AI & ML service proposals targeting Saudi government entities",
        "supported_languages": "AR,EN",
        "project_types_json": '["AI_SERVICES", "DATA_ANALYTICS", "ML_PLATFORM"]',
        "sections": [
            ("ملخص تنفيذي", "Executive Summary", "Write a concise executive summary highlighting Entropy's fit for this RFP, key differentiators (Arabic-first AI, Saudi market expertise, NDMO compliance), and expected outcomes.", 1),
            ("فهم المتطلبات", "Understanding of Requirements", "Demonstrate deep understanding of the client's needs. Reference specific sections of the RFP. Show how Entropy's past work (e.g., Ministry of Interior chatbot, Digital Government Authority BI) maps to these requirements.", 2),
            ("المنهجية المقترحة", "Proposed Methodology", "Detail Entropy's 5-layer AI stack approach: Infrastructure → Governance → Agent Layer → Orchestration → Application. Explain the phased delivery plan.", 3),
            ("القدرات والخبرات", "Capabilities & Experience", "Highlight Entropy's core capabilities: Arabic NLP, Generative AI, Agentic AI (Hydrogen), Data Analytics (Axiom), Speech Recognition, Computer Vision. Reference relevant case studies.", 4),
            ("فريق المشروع", "Project Team", "Describe the proposed team structure, roles, and relevant experience. Emphasize Saudi-based team members and domain expertise.", 5),
            ("الجدول الزمني", "Project Timeline", "Present a detailed Gantt chart / milestone plan. Include discovery, development, testing, deployment, and handover phases.", 6),
            ("الامتثال والجودة", "Compliance & Quality Assurance", "Explain compliance with NDMO standards, data governance requirements, and quality assurance processes. Address any security certifications.", 7),
            ("السعر والميزانية", "Pricing & Budget", "Present transparent pricing structure. Break down costs by phase and deliverable. Include payment milestones.", 8),
        ],
    },
    {
        "name_ar": "قالب مقترح منصة البيانات",
        "name_en": "Data Platform Proposal Template",
        "description_ar": "قالب لمقترحات بناء منصات البيانات وهندسة البيانات",
        "description_en": "Template for data platform, data engineering, and data management proposals",
        "supported_languages": "AR,EN",
        "project_types_json": '["DATA_PLATFORM", "DATA_ENGINEERING", "DATA_MANAGEMENT"]',
        "sections": [
            ("ملخص تنفيذي", "Executive Summary", "Executive summary focused on data platform value: unified data, reliable pipelines, NDMO-compliant governance.", 1),
            ("تقييم الوضع الراهن", "Current State Assessment", "Assess the client's existing data landscape, pain points, and maturity level. Reference Entropy's data assessment methodology.", 2),
            ("معمارية الحل المقترح", "Proposed Solution Architecture", "Detail the target data architecture: data lake/lakehouse, pipelines, governance layer, analytics tier. Use Entropy's Axiom platform where applicable.", 3),
            ("حوكمة البيانات والامتثال", "Data Governance & NDMO Compliance", "Comprehensive section on NDMO alignment, data quality frameworks, metadata management, and data lineage.", 4),
            ("خطة التنفيذ", "Implementation Plan", "Phased delivery: foundation → integration → analytics → optimization. Milestones and success criteria.", 5),
            ("التقنيات والأدوات", "Technologies & Tools", "Entropy's technology stack: Google Cloud / Azure, Databricks, Dataiku, Informatica, custom Entropy tooling.", 6),
            ("السعر والميزانية", "Pricing & Budget", "Detailed cost breakdown by phase, infrastructure, licenses, and professional services.", 7),
        ],
    },
    {
        "name_ar": "قالب مقترح حلول اللغة العربية",
        "name_en": "Arabic NLP & Language Solutions Template",
        "description_ar": "قالب متخصص لمقترحات معالجة اللغة العربية والذكاء الاصطناعي اللغوي",
        "description_en": "Specialized template for Arabic NLP, chatbot, and language AI proposals",
        "supported_languages": "AR,EN",
        "project_types_json": '["ARABIC_NLP", "CHATBOT", "DOCUMENT_INTELLIGENCE", "SPEECH_AI"]',
        "sections": [
            ("ملخص تنفيذي", "Executive Summary", "Highlight Entropy's Arabic-first AI philosophy and proven Arabic NLP delivery for Saudi government entities.", 1),
            ("التحدي اللغوي والحل", "The Arabic Language Challenge & Solution", "Explain the unique challenges of Arabic NLP (dialects, RTL, cultural context) and Entropy's specialized approach.", 2),
            ("المنهجية التقنية", "Technical Methodology", "Detail the Arabic NLP pipeline: preprocessing → embedding → fine-tuning → deployment. Include Arabic-specific model choices.", 3),
            ("المنتجات والتقنيات", "Products & Technologies", "Present relevant Entropy products: Hydrogen (AI Agents), Yameen (Arabic meeting AI), custom Arabic NLP models.", 4),
            ("قصص النجاح", "Success Stories", "Reference Monsha'at AI Consultant, Ministry of Interior Unified Chatbot Platform, and King Salman Global Academy engagements.", 5),
            ("خطة التسليم", "Delivery Plan", "Timeline, milestones, testing (Arabic language acceptance testing), and rollout plan.", 6),
            ("السعر والميزانية", "Pricing & Budget", "Cost structure for Arabic NLP solution including model training, deployment, and ongoing fine-tuning.", 7),
        ],
    },
]


async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        # ── Admin user ──────────────────────────────────────────────────────────
        existing = await db.execute(select(User).where(User.email == "admin@entropy.sa"))
        if existing.scalar_one_or_none():
            print("Admin user already exists.")
        else:
            admin = User(
                email="admin@entropy.sa",
                name="System Admin",
                hashed_password=hash_password("Admin@1234"),
                role="ADMIN",
                is_active=True,
                mfa_enabled=False,
                preferred_language="ar",
                preferred_timezone="Asia/Riyadh",
            )
            db.add(admin)
            await db.commit()
            print("Admin user created: admin@entropy.sa / Admin@1234")

        # ── BD user ─────────────────────────────────────────────────────────────
        existing_bd = await db.execute(select(User).where(User.email == "ahmad@entropy.sa"))
        if existing_bd.scalar_one_or_none():
            print("BD user already exists.")
        else:
            bd = User(
                email="ahmad@entropy.sa",
                name="Ahmad Al-Harbi",
                hashed_password=hash_password("Ahmad@2024"),
                role="BD_PERSON",
                is_active=True,
                mfa_enabled=False,
                preferred_language="ar",
                preferred_timezone="Asia/Riyadh",
            )
            db.add(bd)
            await db.commit()
            print("BD user created: ahmad@entropy.sa / Ahmad@2024")

        # ── Proposal templates ──────────────────────────────────────────────────
        existing_templates = await db.execute(select(Template))
        if existing_templates.scalars().first():
            print("Templates already seeded.")
        else:
            for tmpl in TEMPLATES:
                t = Template(
                    name_ar=tmpl["name_ar"],
                    name_en=tmpl["name_en"],
                    description_ar=tmpl.get("description_ar"),
                    description_en=tmpl.get("description_en"),
                    supported_languages=tmpl["supported_languages"],
                    project_types_json=tmpl.get("project_types_json"),
                )
                db.add(t)
                await db.flush()
                for (title_ar, title_en, ai_instructions, order_index) in tmpl["sections"]:
                    db.add(TemplateSection(
                        template_id=t.id,
                        order_index=order_index,
                        title_ar=title_ar,
                        title_en=title_en,
                        ai_instructions=ai_instructions,
                        is_auto_generated=True,
                        is_required_citations=True,
                    ))
                print(f"  Template: {tmpl['name_en']} ({len(tmpl['sections'])} sections)")

            await db.commit()
            print("Templates seeded.")


async def add_bd_user(name: str, email: str, password: str) -> None:
    """Pre-create a BD Person account (role=BD_PERSON) with a bcrypt-hashed password.

    Usage:
        python seed.py --add-bd-user --name "Ahmad Al-Harbi" --email "ahmad@entropy.sa" --password "..."
    """
    from sqlalchemy import select

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            print(f"User {email} already exists — skipping.")
            return

        user = User(
            email=email,
            name=name,
            hashed_password=hash_password(password),
            role="BD_PERSON",
            is_active=True,
            mfa_enabled=False,
            preferred_language="ar",
            preferred_timezone="Asia/Riyadh",
        )
        db.add(user)
        await db.commit()
        print(f"BD Person created: {email} (display name: {name})")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Entropy seed script")
    parser.add_argument("--add-bd-user", action="store_true", help="Create a BD Person account")
    parser.add_argument("--name", type=str, help="Display name for BD Person")
    parser.add_argument("--email", type=str, help="Email for BD Person")
    parser.add_argument("--password", type=str, help="Plain-text password (will be bcrypt-hashed)")
    args = parser.parse_args()

    if args.add_bd_user:
        if not args.name or not args.email or not args.password:
            parser.error("--add-bd-user requires --name, --email, and --password")
        asyncio.run(add_bd_user(args.name, args.email, args.password))
    else:
        asyncio.run(seed())
