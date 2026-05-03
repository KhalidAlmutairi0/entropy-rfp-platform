"""Knowledge base management router."""

import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.rbac import Permission
from core.security import require_permission
from models.knowledge_doc import KnowledgeDoc
from models.user import User
from schemas.common import PaginatedResponse
from schemas.knowledge import KBStats, KnowledgeDocCreate, KnowledgeDocResponse, KnowledgeDocUpdate
from services.audit import log_action
from services.storage import StorageService

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}


def _sanitize_filename(filename: str | None, fallback: str) -> str:
    """Strip path traversal sequences from a filename."""
    if not filename:
        return fallback
    safe = os.path.basename(filename).strip()
    safe = safe.replace("..", "").replace("/", "").replace("\\", "").strip()
    return safe or fallback


@router.get("", response_model=PaginatedResponse[KnowledgeDocResponse])
async def list_docs(
    doc_type: str | None = None,
    language: str | None = None,
    year: int | None = None,
    search: str | None = None,
    outcome: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(require_permission(Permission.VIEW_RFP)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[KnowledgeDocResponse]:
    query = select(KnowledgeDoc).where(KnowledgeDoc.is_deleted == False)  # noqa: E712
    if doc_type:
        query = query.where(KnowledgeDoc.doc_type == doc_type)
    if language:
        query = query.where(KnowledgeDoc.language == language)
    if year:
        query = query.where(KnowledgeDoc.year == year)
    if outcome:
        query = query.where(KnowledgeDoc.outcome == outcome)
    if search:
        query = query.where(KnowledgeDoc.title.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    offset = (page - 1) * page_size
    docs = (await db.execute(query.order_by(KnowledgeDoc.last_used_at.desc().nullslast()).offset(offset).limit(page_size))).scalars().all()

    items = []
    for doc in docs:
        resp = KnowledgeDocResponse.model_validate(doc)
        resp.tags = json.loads(doc.tags_json or "[]")
        items.append(resp)

    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=(total + page_size - 1) // page_size)


@router.post("/upload", response_model=KnowledgeDocResponse, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_doc(
    # Fix Bug #13: BackgroundTasks must NOT have a default value — FastAPI injects it.
    # Using BackgroundTasks() as a default creates a shared instance across all requests.
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form(...),
    language: str = Form("AR"),
    year: int | None = Form(None),
    tags: str = Form("[]"),  # JSON array string
    outcome: str = Form("NA"),
    current_user: User = Depends(require_permission(Permission.MANAGE_KB)),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(StorageService.get_instance),
) -> KnowledgeDocResponse:
    content = await file.read()

    # Fix Bug #22: validate file type before processing
    filename = file.filename or "document"
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(_ALLOWED_EXTENSIONS)}",
        )
    if file.content_type and file.content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type '{file.content_type}'.",
        )

    content_hash = hashlib.sha256(content).hexdigest()

    # Check for duplicates
    existing = (await db.execute(
        select(KnowledgeDoc).where(KnowledgeDoc.content_hash == content_hash, KnowledgeDoc.is_deleted == False)  # noqa: E712
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Duplicate document detected (matches doc ID {existing.id})")

    # Fix Bug #8: sanitize filename to prevent path traversal
    safe_filename = _sanitize_filename(file.filename, f"doc_{content_hash[:8]}")
    storage_path = f"knowledge/{doc_type.lower()}/{safe_filename}"
    await storage.upload_file(content, storage_path, file.content_type or "application/octet-stream")

    doc = KnowledgeDoc(
        title=title,
        doc_type=doc_type,
        language=language,
        year=year,
        tags_json=tags,
        outcome=outcome,
        storage_path=storage_path,
        size_bytes=len(content),
        content_hash=content_hash,
    )
    db.add(doc)
    await db.flush()

    from tasks.indexing_tasks import index_knowledge_doc_task
    background_tasks.add_task(index_knowledge_doc_task, str(doc.id))

    resp = KnowledgeDocResponse.model_validate(doc)
    resp.tags = json.loads(tags)
    return resp


@router.get("/stats", response_model=KBStats)
async def get_stats(
    current_user: User = Depends(require_permission(Permission.VIEW_RFP)),
    db: AsyncSession = Depends(get_db),
) -> KBStats:
    total = (await db.execute(select(func.count()).select_from(KnowledgeDoc).where(KnowledgeDoc.is_deleted == False))).scalar_one()  # noqa: E712
    indexed = (await db.execute(select(func.count()).select_from(KnowledgeDoc).where(KnowledgeDoc.is_indexed == True, KnowledgeDoc.is_deleted == False))).scalar_one()  # noqa: E712
    failed = (await db.execute(select(func.count()).select_from(KnowledgeDoc).where(KnowledgeDoc.is_indexed == False, KnowledgeDoc.is_deleted == False))).scalar_one()  # noqa: E712

    type_results = await db.execute(
        select(KnowledgeDoc.doc_type, func.count()).select_from(KnowledgeDoc).where(KnowledgeDoc.is_deleted == False).group_by(KnowledgeDoc.doc_type)  # noqa: E712
    )
    by_type = {row[0]: row[1] for row in type_results.all()}

    return KBStats(total=total, indexed=indexed, failed=failed, last_sync_at=None, by_type=by_type)


@router.get("/{doc_id}", response_model=KnowledgeDocResponse)
async def get_doc(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_permission(Permission.VIEW_RFP)),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeDocResponse:
    doc = (await db.execute(select(KnowledgeDoc).where(KnowledgeDoc.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    resp = KnowledgeDocResponse.model_validate(doc)
    resp.tags = json.loads(doc.tags_json or "[]")
    return resp


@router.post("/{doc_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
async def reindex_doc(
    doc_id: uuid.UUID,
    # Fix Bug #13: remove BackgroundTasks() default value
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_permission(Permission.MANAGE_KB)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    doc = (await db.execute(select(KnowledgeDoc).where(KnowledgeDoc.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    from tasks.indexing_tasks import index_knowledge_doc_task
    background_tasks.add_task(index_knowledge_doc_task, str(doc_id))
    return {"status": "reindex queued"}
