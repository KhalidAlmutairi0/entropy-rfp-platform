"""RFP management router."""

import hashlib
import io
import json
import os
import uuid
from pathlib import Path
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.rbac import Permission
from core.security import get_current_user, require_permission
from models.decision import Decision
from models.rfp import RFP
from models.rfp_file import FileStatus, FileType, RFPFile
from models.user import User
from schemas.common import PaginatedResponse
from schemas.rfp import RFPFilter, RFPListResponse, RFPResponse, RFPUpdate
from services.audit import log_action
from services.cache import get_redis
from services.storage import StorageService

router = APIRouter(prefix="/rfps", tags=["rfp"])

_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}


def _sanitize_filename(filename: str | None, fallback: str) -> str:
    """Strip path traversal sequences and unsafe characters from a filename."""
    if not filename:
        return fallback
    safe = os.path.basename(filename).strip()
    # Remove any remaining path separators or traversal attempts
    safe = safe.replace("..", "").replace("/", "").replace("\\", "").strip()
    return safe or fallback


def _validate_upload_file(file: UploadFile, content: bytes, idx: int) -> None:
    """Raise 400 if the file type is not an allowed document format."""
    filename = file.filename or f"file_{idx}"
    ext = Path(filename).suffix.lower()

    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}': unsupported extension '{ext}'. Allowed: {', '.join(_ALLOWED_EXTENSIONS)}",
        )

    if file.content_type and file.content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}': unsupported content type '{file.content_type}'.",
        )

    # Verify PDF magic bytes
    if ext == ".pdf" and len(content) >= 4 and content[:4] != b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}' does not appear to be a valid PDF.",
        )


@router.get("", response_model=PaginatedResponse[RFPListResponse])
async def list_rfps(
    filters: Annotated[RFPFilter, Depends()],
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_RFP))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PaginatedResponse[RFPListResponse]:
    """List all RFPs with optional filtering and pagination."""
    query = select(RFP).where(RFP.is_deleted == False)  # noqa: E712

    if filters.status:
        query = query.where(RFP.status == filters.status)
    if filters.agency:
        query = query.where(RFP.agency.ilike(f"%{filters.agency}%"))
    if filters.owner_id:
        query = query.where(RFP.owner_id == filters.owner_id)
    if filters.language:
        query = query.where(RFP.language == filters.language)
    if filters.search:
        query = query.where(
            (RFP.title_ar.ilike(f"%{filters.search}%")) | (RFP.title_en.ilike(f"%{filters.search}%"))
        )
    if filters.date_from:
        query = query.where(RFP.created_at >= filters.date_from)
    if filters.date_to:
        query = query.where(RFP.created_at <= filters.date_to)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    offset = (filters.page - 1) * filters.page_size
    result = await db.execute(
        query.options(selectinload(RFP.decision)).order_by(RFP.updated_at.desc()).offset(offset).limit(filters.page_size)
    )
    rfps = result.scalars().all()

    items = []
    for rfp in rfps:
        item = RFPListResponse.model_validate(rfp)
        if rfp.decision:
            item.fit_score = rfp.decision.total_score
            item.decision_type = rfp.decision.decision_type
        items.append(item)

    return PaginatedResponse(
        items=items,
        total=total,
        page=filters.page,
        page_size=filters.page_size,
        total_pages=(total + filters.page_size - 1) // filters.page_size,
    )


@router.post("/upload", response_model=RFPResponse, status_code=status.HTTP_201_CREATED)
async def upload_rfp(
    request: Request,
    files: list[UploadFile] = File(...),
    file_types: str = Form("MAIN"),
    title_ar: str | None = Form(None),
    title_en: str | None = Form(None),
    agency: str | None = Form(None),
    tender_number: str | None = Form(None),
    language: str = Form("AR"),
    deadline: str | None = Form(None),
    estimated_value_sar: float | None = Form(None),
    current_user: User = Depends(require_permission(Permission.UPLOAD_RFP)),
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(StorageService.get_instance),
) -> RFPResponse:
    """Upload one or more RFP files (main + annexes)."""
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    # Validate total size (500 MB limit)
    total_size = sum(f.size or 0 for f in files)
    if total_size > 500 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Total file size exceeds 500 MB")

    type_list = [t.strip() for t in file_types.split(",")]

    if len(files) != len(type_list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type mismatch: {len(files)} files provided but {len(type_list)} types specified.",
        )

    # Create RFP record
    from datetime import datetime
    rfp = RFP(
        title_ar=title_ar,
        title_en=title_en,
        agency=agency,
        tender_number=tender_number,
        language=language,
        deadline=datetime.fromisoformat(deadline) if deadline else None,
        estimated_value_sar=estimated_value_sar,
        owner_id=current_user.id,
        file_count=len(files),
    )
    db.add(rfp)
    await db.flush()

    rfp_files = []
    for idx, (file, ftype) in enumerate(zip(files, type_list)):
        content = await file.read()

        # Validate file type (extension + magic bytes)
        _validate_upload_file(file, content, idx)

        # Check for password-protected PDF
        if content[:4] == b"%PDF" and b"/Encrypt" in content[:2048]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File {file.filename} is password-protected. Please remove the password before uploading.",
            )

        content_hash = hashlib.sha256(content).hexdigest()

        # Sanitize filename to prevent path traversal
        safe_filename = _sanitize_filename(file.filename, f"file_{idx}")
        storage_path = f"rfps/{rfp.id}/{safe_filename}"
        await storage.upload_file(content, storage_path, file.content_type or "application/octet-stream")

        rfp_file = RFPFile(
            rfp_id=rfp.id,
            filename=safe_filename,
            file_type=ftype if ftype in [ft.value for ft in FileType] else FileType.OTHER.value,
            storage_path=storage_path,
            size_bytes=len(content),
            mime_type=file.content_type,
            content_hash=content_hash,
            status=FileStatus.UPLOADED.value,
        )
        db.add(rfp_file)
        rfp_files.append(rfp_file)

    await db.flush()
    await log_action(db, current_user.id, "upload_rfp", "rfp", str(rfp.id), ip_address=request.client.host if request.client else None)

    result = await db.execute(
        select(RFP).options(selectinload(RFP.files)).where(RFP.id == rfp.id)
    )
    return RFPResponse.model_validate(result.scalar_one())


@router.get("/{rfp_id}", response_model=RFPResponse)
async def get_rfp(
    rfp_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_RFP))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RFPResponse:
    result = await db.execute(
        select(RFP).options(selectinload(RFP.files)).where(RFP.id == rfp_id, RFP.is_deleted == False)  # noqa: E712
    )
    rfp = result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")
    return RFPResponse.model_validate(rfp)


@router.patch("/{rfp_id}", response_model=RFPResponse)
async def update_rfp(
    rfp_id: uuid.UUID,
    body: RFPUpdate,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.UPLOAD_RFP))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RFPResponse:
    result = await db.execute(select(RFP).where(RFP.id == rfp_id, RFP.is_deleted == False))  # noqa: E712
    rfp = result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rfp, key, value)

    await log_action(db, current_user.id, "update_rfp", "rfp", str(rfp_id), new_value=json.dumps(update_data), ip_address=request.client.host if request.client else None)
    return RFPResponse.model_validate(rfp)


@router.delete("/{rfp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rfp(
    rfp_id: uuid.UUID,
    request: Request,
    current_user: Annotated[User, Depends(require_permission(Permission.MANAGE_KB))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(select(RFP).where(RFP.id == rfp_id))
    rfp = result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")
    rfp.is_deleted = True
    await log_action(db, current_user.id, "delete_rfp", "rfp", str(rfp_id), ip_address=request.client.host if request.client else None)


@router.post("/{rfp_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
async def trigger_analysis(
    rfp_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_permission(Permission.RUN_ANALYSIS))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Trigger the ingestion + qualification pipeline for an RFP."""
    result = await db.execute(select(RFP).where(RFP.id == rfp_id, RFP.is_deleted == False))  # noqa: E712
    rfp = result.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFP not found")

    task_id = str(uuid.uuid4())

    # Fix Bug #6: Set status and commit BEFORE dispatching the task to prevent
    # the race condition where the worker reads stale status from the DB.
    rfp.status = "ANALYZING"
    rfp.processing_task_id = task_id
    await log_action(db, current_user.id, "trigger_analysis", "rfp", str(rfp_id), ip_address=request.client.host if request.client else None)
    await db.commit()

    try:
        from tasks.ingestion_tasks import process_rfp_task
        celery_task = process_rfp_task.delay(str(rfp_id))
        task_id = celery_task.id
        # Update task_id to the real Celery task ID
        rfp.processing_task_id = task_id
        await db.commit()
    except Exception:
        # Celery broker not available — run directly in FastAPI background thread
        import asyncio
        from tasks.ingestion_tasks import _process_rfp_async

        def _run(rid: str) -> None:
            asyncio.run(_process_rfp_async(rid, None))

        background_tasks.add_task(_run, str(rfp_id))

    return {"task_id": task_id, "status": "queued"}


@router.get("/{rfp_id}/status/stream")
async def stream_processing_status(
    rfp_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_RFP))],
) -> StreamingResponse:
    """Server-Sent Events stream for live processing updates."""
    redis = await get_redis()

    # Fix Bug #7: Redis unavailable — return a graceful fallback instead of crashing
    if redis is None:
        async def unavailable_stream() -> AsyncGenerator[str, None]:
            yield (
                'data: {"step":"error","status":"unavailable",'
                '"message":"Real-time streaming requires Redis. Poll GET /rfps/{rfp_id} for status."}\n\n'
            )
        return StreamingResponse(unavailable_stream(), media_type="text/event-stream")

    async def event_generator() -> AsyncGenerator[str, None]:
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"rfp:processing:{rfp_id}")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
        finally:
            await pubsub.unsubscribe(f"rfp:processing:{rfp_id}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")
