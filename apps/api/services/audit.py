"""Audit log service — records every significant action."""

import json
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Insert an audit log entry. Call this after every significant state change."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        old_value=json.dumps(old_value) if old_value is not None and not isinstance(old_value, str) else old_value,
        new_value=json.dumps(new_value) if new_value is not None and not isinstance(new_value, str) else new_value,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    # Note: caller is responsible for committing the session
