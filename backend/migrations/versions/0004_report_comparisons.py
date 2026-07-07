"""report_comparisons: persist current↔prior study pairings

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-07 04:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "report_comparisons",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("current_report_id", sa.String(), nullable=False),
        sa.Column("prior_study_uid", sa.String(), nullable=False),
        sa.Column("prior_series_uid", sa.String(), nullable=True),
        sa.Column("time_delta_days", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_report_comparisons_current_report_id"),
        "report_comparisons",
        ["current_report_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_report_comparisons_current_report_id"), table_name="report_comparisons")
    op.drop_table("report_comparisons")
