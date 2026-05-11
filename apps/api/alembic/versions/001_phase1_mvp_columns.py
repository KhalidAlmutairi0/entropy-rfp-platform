"""Phase 1 MVP — add uploaded_by_name, deck columns to rfps; add BD_PERSON role support.

Revision ID: 001_phase1_mvp
Revises:
Create Date: 2026-05-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_phase1_mvp"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add uploaded_by_name (denormalized immutable display name set at upload time)
    op.add_column("rfps", sa.Column("uploaded_by_name", sa.String(255), nullable=True))
    # Add deck generation tracking columns
    op.add_column("rfps", sa.Column("deck_pdf_path", sa.String(500), nullable=True))
    op.add_column("rfps", sa.Column("deck_status", sa.String(50), nullable=True))
    op.add_column("rfps", sa.Column("deck_task_id", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("rfps", "deck_task_id")
    op.drop_column("rfps", "deck_status")
    op.drop_column("rfps", "deck_pdf_path")
    op.drop_column("rfps", "uploaded_by_name")
