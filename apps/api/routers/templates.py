import json as _json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.security import get_current_user
from core.rbac import Permission
from core.security import require_permission
from models.template import Template, TemplateSection
from models.user import User
from schemas.common import PaginatedResponse
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/templates", tags=["templates"])


class TemplateSectionCreate(BaseModel):
    title_ar: str
    title_en: Optional[str] = None
    order_index: int
    is_required: bool = False
    default_prompt: Optional[str] = None


class TemplateCreate(BaseModel):
    name_ar: str
    name_en: Optional[str] = None
    supported_languages: List[str] = ["ar"]
    project_types: Optional[List[str]] = None
    sections: Optional[List[TemplateSectionCreate]] = None


class TemplateResponse(BaseModel):
    id: str
    name_ar: str
    name_en: Optional[str]
    supported_languages: List[str]
    project_types: Optional[List[str]]
    used_count: int
    win_count: int
    win_rate: Optional[float]
    sections: Optional[list] = None

    class Config:
        from_attributes = True


@router.get("", response_model=PaginatedResponse)
async def list_templates(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offset = (page - 1) * page_size
    total_result = await db.execute(select(func.count()).select_from(Template))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Template)
        .order_by(Template.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    templates = result.scalars().all()

    items = []
    for t in templates:
        sections_result = await db.execute(
            select(TemplateSection)
            .where(TemplateSection.template_id == t.id)
            .order_by(TemplateSection.order_index)
        )
        sections = sections_result.scalars().all()
        items.append({
            "id": str(t.id),
            "nameAr": t.name_ar,
            "nameEn": t.name_en,
            "supportedLanguages": t.supported_languages.split(",") if t.supported_languages else [],
            "projectTypes": _json.loads(t.project_types_json) if t.project_types_json else [],
            "usedCount": t.used_count,
            "winCount": t.win_count,
            "winRate": t.win_rate,
            "sections": [
                {
                    "id": str(s.id),
                    "titleAr": s.title_ar,
                    "titleEn": s.title_en,
                    "orderIndex": s.order_index,
                    "isRequired": s.is_required_citations,
                }
                for s in sections
            ],
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.MANAGE_TEMPLATES)),
):
    template = Template(
        name_ar=data.name_ar,
        name_en=data.name_en,
        supported_languages=data.supported_languages,
        project_types_json=data.project_types,
    )
    db.add(template)
    await db.flush()

    if data.sections:
        for s in data.sections:
            section = TemplateSection(
                template_id=template.id,
                title_ar=s.title_ar,
                title_en=s.title_en,
                order_index=s.order_index,
                is_required_citations=getattr(s, "is_required", True),
                ai_instructions=getattr(s, "default_prompt", None),
            )
            db.add(section)

    await db.commit()
    await db.refresh(template)
    return {"id": str(template.id), "nameAr": template.name_ar}


@router.get("/{template_id}")
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    sections_result = await db.execute(
        select(TemplateSection)
        .where(TemplateSection.template_id == template_id)
        .order_by(TemplateSection.order_index)
    )
    sections = sections_result.scalars().all()

    return {
        "id": str(template.id),
        "nameAr": template.name_ar,
        "nameEn": template.name_en,
        "supportedLanguages": template.supported_languages.split(",") if template.supported_languages else [],
        "projectTypes": _json.loads(template.project_types_json) if template.project_types_json else [],
        "usedCount": template.used_count,
        "winCount": template.win_count,
        "winRate": template.win_rate,
        "sections": [
            {
                "id": str(s.id),
                "titleAr": s.title_ar,
                "titleEn": s.title_en,
                "orderIndex": s.order_index,
                "isRequired": s.is_required_citations,
            }
            for s in sections
        ],
    }


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.MANAGE_TEMPLATES)),
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
