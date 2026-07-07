"""audit_events.seq: single unique index matching the model

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-07 03:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index(op.f("ix_audit_events_seq"), table_name="audit_events")
    with op.batch_alter_table("audit_events") as batch_op:
        batch_op.drop_constraint("uq_audit_events_seq", type_="unique")
    op.create_index(op.f("ix_audit_events_seq"), "audit_events", ["seq"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_audit_events_seq"), table_name="audit_events")
    with op.batch_alter_table("audit_events") as batch_op:
        batch_op.create_unique_constraint("uq_audit_events_seq", ["seq"])
    op.create_index(op.f("ix_audit_events_seq"), "audit_events", ["seq"], unique=False)
