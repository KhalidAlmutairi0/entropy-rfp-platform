"""Audit log router."""

import csv
import io
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.rbac import Permission
from core.security import require_permission
from models.audit_log import AuditLog
from models.user import User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def list_audit_logs(
    user_id: str | None = None,
    action: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_AUDIT_LOG))] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    query = select(AuditLog)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
    if target_id:
        query = query.where(AuditLog.target_id == target_id)
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at <= date_to)

    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    logs = (await db.execute(query)).scalars().all()

    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/export")
async def export_audit_csv(
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_AUDIT_LOG))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    """Export audit log as CSV."""
    logs = (await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10000))).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Time", "User ID", "Action", "Target Type", "Target ID", "IP Address"])
    for log in logs:
        writer.writerow([
            log.created_at.isoformat(),
            str(log.user_id) if log.user_id else "",
            log.action,
            log.target_type or "",
            log.target_id or "",
            log.ip_address or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )
