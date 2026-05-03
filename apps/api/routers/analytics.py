"""Analytics router — pipeline KPIs, win/loss charts, AI insights."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.rbac import Permission
from core.security import require_permission
from models.decision import Decision
from models.proposal import Proposal
from models.rfp import RFP, RFPStatus
from models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/kpis")
async def get_kpis(
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_ANALYTICS))],
    db: Annotated[AsyncSession, Depends(get_db)],
    # Fix Bug #23: cap the days parameter to prevent full-table scans
    days: int = Query(default=90, ge=1, le=730),
) -> dict:
    since = datetime.now(UTC) - timedelta(days=days)

    active_count = (await db.execute(
        select(func.count()).select_from(RFP).where(
            RFP.status.in_(["ANALYZING", "DECISION_READY", "ACTION_REQUIRED", "DRAFTING", "IN_REVIEW"]),
            RFP.is_deleted == False,  # noqa: E712
        )
    )).scalar_one()

    # Fix Bug #16: use a single grouped query to prevent review_count going negative
    # under concurrent writes across multiple separate COUNT queries.
    decision_rows = (await db.execute(
        select(Decision.decision_type, func.count().label("cnt"))
        .where(Decision.created_at >= since)
        .group_by(Decision.decision_type)
    )).all()
    decision_counts = {row.decision_type: row.cnt for row in decision_rows}
    go_count = decision_counts.get("GO", 0)
    no_go_count = decision_counts.get("NO_GO", 0)
    review_count = decision_counts.get("REVIEW", 0)
    decisions_made = go_count + no_go_count + review_count

    won = (await db.execute(
        select(func.count()).select_from(Proposal).where(Proposal.outcome == "WON", Proposal.updated_at >= since)
    )).scalar_one()

    lost = (await db.execute(
        select(func.count()).select_from(Proposal).where(Proposal.outcome == "LOST", Proposal.updated_at >= since)
    )).scalar_one()

    total_decided = won + lost
    win_rate = round(won / total_decided * 100, 1) if total_decided > 0 else 0.0

    # Per-status RFP counts for dashboard pipeline stats
    status_rows = (await db.execute(
        select(RFP.status, func.count().label("cnt"))
        .where(RFP.is_deleted == False)  # noqa: E712
        .group_by(RFP.status)
    )).all()
    status_counts = {row.status: row.cnt for row in status_rows}

    return {
        "period_days": days,
        "pipeline": {
            "active": active_count,
            "by_status": {k.lower(): v for k, v in status_counts.items()},
        },
        "decisions": {
            "total": decisions_made,
            "go": go_count,
            "no_go": no_go_count,
            "review": review_count,
        },
        "outcomes": {"won": won, "lost": lost, "win_rate": win_rate},
    }


@router.get("/charts/win-rate-by-project-type")
async def win_rate_by_project_type(
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_ANALYTICS))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Win rate grouped by project type.
    NOTE: Project type tagging is not yet implemented on proposals.
    Returns an empty list until tags are added to the data model.
    """
    # Fix Bug #20: removed hardcoded fake data that was misrepresenting real business KPIs.
    return []


@router.get("/charts/decisions-over-time")
async def decisions_over_time(
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_ANALYTICS))],
    db: Annotated[AsyncSession, Depends(get_db)],
    # Fix Bug #23: cap the days parameter
    days: int = Query(default=90, ge=1, le=730),
) -> list[dict]:
    since = datetime.now(UTC) - timedelta(days=days)

    # Fix Bug #15: date_trunc is PostgreSQL-only and crashes on SQLite (dev database).
    # Use a dialect-safe expression.
    if settings.database_url.startswith("sqlite"):
        week_expr = func.strftime("%Y-%W", Decision.created_at).label("week")
    else:
        week_expr = func.date_trunc("week", Decision.created_at).label("week")

    result = await db.execute(
        select(
            week_expr,
            func.count().label("count"),
            Decision.decision_type,
        ).where(Decision.created_at >= since).group_by("week", Decision.decision_type).order_by("week")
    )
    rows = result.all()
    return [{"week": str(row.week), "count": row.count, "decision_type": row.decision_type} for row in rows]
