"""Migrate every timestamp column from String to timezone-aware DateTime.

Closes the second half of #102. The columns held ISO-8601 strings, so every
range query and ORDER BY was a lexicographic comparison that only agreed with
chronological order while all values were UTC, zero-padded and same-precision.
One row written with a ``+02:00`` offset was enough to sort wrong, and date
arithmetic and date-based indexes were unavailable entirely.

Data migration
--------------
On PostgreSQL the values are converted in place with an explicit
``USING ...::timestamptz`` cast, which reads the offset the string carries.

SQLite has no ``ALTER COLUMN``, so only the values are rewritten — from
``2026-07-01T12:00:00.123456+00:00`` to the ``YYYY-MM-DD HH:MM:SS.ffffff``
layout SQLAlchemy's ``DateTime`` reads back. The declared column type is
deliberately left as ``VARCHAR``:

- SQLite is dynamically typed, and SQLAlchemy picks its result processor from
  the *model's* column type, not the database's declared one, so the two are
  indistinguishable at runtime. A database migrated here and a fresh one built
  by ``create_all`` (which does declare ``DATETIME``) both read back as aware
  UTC datetimes.
- Alembic's ``batch_alter_table`` implements a type change by rebuilding the
  table with ``CAST(col AS DATETIME)``, and ``DATETIME`` carries NUMERIC
  affinity in SQLite: ``CAST('2026-07-01 12:00:00.123456' AS DATETIME)`` is the
  integer ``2026``. Every timestamp in the database would be silently replaced
  by its year.

SQLite is a development/test backend for this project; the path exists so a
developer's database is not left unreadable (or, worse, quietly wrong).

Audit hash chain
----------------
``audit_events.timestamp`` is part of the tamper-evidence hash
(``app.utils.hashing.compute_audit_event_hash``), so the chain would break if
the migration altered the instant a row represents.  It does not: every value
was written by ``utc_now()`` and therefore carries a ``+00:00`` offset, which
survives the cast, and the hash canonicalises through
``ensure_utc(...).isoformat()`` — the same string the column used to hold.
``GET /api/v1/audit-log/verify`` should still report ``valid: true`` after
this runs, and that is the thing to check first if it does not.

A ``+HH:MM`` offset other than UTC would be preserved as the same instant but
render differently, which would break the chain for those rows. No writer in
this codebase produces one; a database that acquired such rows by other means
should be checked with the verify endpoint before and after.

Revision ID: 0005_timestamps
Revises: 0004_perf_indexes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_timestamps"
down_revision: str | Sequence[str] | None = "0004_perf_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (table, column, nullable) for every timestamp column in app.models.
TIMESTAMP_COLUMNS: list[tuple[str, str, bool]] = [
    ("annotations", "created_at", False),
    ("annotations", "updated_at", True),
    ("annotations", "verified_at", True),
    ("audit_events", "timestamp", False),
    ("critical_finding_alerts", "notified_at", False),
    ("critical_finding_alerts", "acknowledged_at", True),
    ("drift_snapshots", "created_at", False),
    ("guidelines", "created_at", False),
    ("guidelines", "updated_at", False),
    ("inference_jobs", "queued_at", False),
    ("inference_jobs", "started_at", True),
    ("inference_jobs", "completed_at", True),
    ("peer_reviews", "created_at", False),
    ("peer_reviews", "completed_at", True),
    ("prompt_templates", "created_at", False),
    ("prompt_templates", "updated_at", False),
    ("qa_results", "created_at", False),
    ("qa_rules", "created_at", False),
    ("qa_rules", "updated_at", False),
    ("report_comparisons", "created_at", False),
    ("report_revisions", "changed_at", False),
    ("reports", "created_at", False),
    ("reports", "updated_at", False),
    ("reports", "approved_at", True),
    ("segmentation_jobs", "created_at", False),
    ("segmentation_jobs", "updated_at", True),
    ("users", "created_at", False),
]


def _existing_tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    tables = _existing_tables()
    is_sqlite = bind.dialect.name == "sqlite"

    for table, column, nullable in TIMESTAMP_COLUMNS:
        if table not in tables:
            continue

        if is_sqlite:
            # Values only — see the module docstring for why the declared type
            # is left alone. '2026-08-02T07:19:49.123456+00:00' becomes
            # '2026-08-02 07:19:49.123456', the layout SQLAlchemy's DateTime
            # result processor parses. Every value is UTC, so dropping the
            # offset loses nothing; UTCDateTime re-tags it on read.
            op.execute(
                sa.text(
                    f'UPDATE "{table}" '
                    f'SET "{column}" = replace('
                    f"  replace(replace(\"{column}\", 'T', ' '), '+00:00', ''), "
                    f"  'Z', '') "
                    f'WHERE "{column}" IS NOT NULL'
                )
            )
        else:
            op.alter_column(
                table,
                column,
                type_=sa.DateTime(timezone=True),
                existing_type=sa.String(),
                existing_nullable=nullable,
                postgresql_using=f'"{column}"::timestamptz',
            )


def downgrade() -> None:
    bind = op.get_bind()
    tables = _existing_tables()
    is_sqlite = bind.dialect.name == "sqlite"

    for table, column, nullable in TIMESTAMP_COLUMNS:
        if table not in tables:
            continue

        if is_sqlite:
            op.execute(
                sa.text(
                    f'UPDATE "{table}" '
                    f"SET \"{column}\" = replace(\"{column}\", ' ', 'T') || '+00:00' "
                    f'WHERE "{column}" IS NOT NULL'
                )
            )
        else:
            # Reproduce datetime.isoformat() exactly, because that is the
            # string the audit hash chain was computed over: a literal 'T',
            # a '+00:00' offset, and — the easy one to miss — no fractional
            # part at all when the microseconds are zero, where to_char would
            # always write '.000000'.
            op.alter_column(
                table,
                column,
                type_=sa.String(),
                existing_type=sa.DateTime(timezone=True),
                existing_nullable=nullable,
                postgresql_using=(
                    "regexp_replace("
                    f"to_char(\"{column}\" AT TIME ZONE 'UTC', "
                    "'YYYY-MM-DD\"T\"HH24:MI:SS.US'), "
                    "'\\.000000$', '') || '+00:00'"
                ),
            )
