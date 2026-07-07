"""performance indexes on reports and audit_events filter/sort columns

Revision ID: 0004_perf_indexes
Revises: 0003
Create Date: 2026-07-07 05:00:00.000000

NOTE: another in-flight branch also adds a "0004" migration
(``ReportComparison``, down_revision "0003"). Whichever of the two merges
second will need `alembic merge heads` to reconcile the resulting fork.

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_perf_indexes"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(op.f("ix_reports_study_id"), "reports", ["study_id"])
    op.create_index(op.f("ix_reports_patient_id"), "reports", ["patient_id"])
    op.create_index(op.f("ix_reports_status"), "reports", ["status"])
    op.create_index(op.f("ix_audit_events_timestamp"), "audit_events", ["timestamp"])
    op.create_index(op.f("ix_audit_events_report_id"), "audit_events", ["report_id"])
    op.create_index(op.f("ix_audit_events_study_id"), "audit_events", ["study_id"])
    op.create_index(op.f("ix_audit_events_actor_id"), "audit_events", ["actor_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_audit_events_actor_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_study_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_report_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_timestamp"), table_name="audit_events")
    op.drop_index(op.f("ix_reports_status"), table_name="reports")
    op.drop_index(op.f("ix_reports_patient_id"), table_name="reports")
    op.drop_index(op.f("ix_reports_study_id"), table_name="reports")
