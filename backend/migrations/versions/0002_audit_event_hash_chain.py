"""audit event hash chain

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-06 17:00:00.000000

"""

import hashlib
import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _event_hash(
    seq: int,
    prev_hash: str | None,
    event_type: str,
    actor_id: str | None,
    report_id: str | None,
    study_id: str | None,
    timestamp: str,
    metadata: dict | None,
) -> str:
    """Must stay in lockstep with app.utils.hashing.compute_audit_event_hash."""
    canonical = json.dumps(
        {
            "seq": seq,
            "prev_hash": prev_hash,
            "event_type": event_type,
            "actor_id": actor_id,
            "report_id": report_id,
            "study_id": study_id,
            "timestamp": timestamp,
            "metadata": metadata or {},
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("audit_events", sa.Column("seq", sa.Integer(), nullable=True))
    op.add_column("audit_events", sa.Column("prev_hash", sa.String(), nullable=True))
    op.add_column("audit_events", sa.Column("event_hash", sa.String(), nullable=True))

    audit_events = sa.table(
        "audit_events",
        sa.column("id", sa.String()),
        sa.column("event_type", sa.String()),
        sa.column("actor_id", sa.String()),
        sa.column("report_id", sa.String()),
        sa.column("study_id", sa.String()),
        sa.column("timestamp", sa.String()),
        sa.column("metadata", sa.JSON()),
        sa.column("seq", sa.Integer()),
        sa.column("prev_hash", sa.String()),
        sa.column("event_hash", sa.String()),
    )

    bind = op.get_bind()
    # Best-effort chronological order for pre-existing rows: there is no
    # reliable total order for events written before `seq` existed, so this
    # establishes a hash chain going forward rather than proving anything
    # about history predating this migration.
    rows = bind.execute(
        sa.select(
            audit_events.c.id,
            audit_events.c.event_type,
            audit_events.c.actor_id,
            audit_events.c.report_id,
            audit_events.c.study_id,
            audit_events.c.timestamp,
            audit_events.c.metadata,
        ).order_by(audit_events.c.timestamp, audit_events.c.id)
    ).fetchall()

    prev_hash = None
    for i, row in enumerate(rows, start=1):
        event_hash = _event_hash(
            i,
            prev_hash,
            row.event_type,
            row.actor_id,
            row.report_id,
            row.study_id,
            row.timestamp,
            row.metadata,
        )
        bind.execute(
            audit_events.update()
            .where(audit_events.c.id == row.id)
            .values(seq=i, prev_hash=prev_hash, event_hash=event_hash)
        )
        prev_hash = event_hash

    with op.batch_alter_table("audit_events") as batch_op:
        batch_op.alter_column("seq", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("event_hash", existing_type=sa.String(), nullable=False)
        batch_op.create_unique_constraint("uq_audit_events_seq", ["seq"])
    op.create_index(op.f("ix_audit_events_seq"), "audit_events", ["seq"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_audit_events_seq"), table_name="audit_events")
    with op.batch_alter_table("audit_events") as batch_op:
        batch_op.drop_constraint("uq_audit_events_seq", type_="unique")
        batch_op.drop_column("event_hash")
        batch_op.drop_column("prev_hash")
        batch_op.drop_column("seq")
