"""rename job_samples sample_id and add integer fk

Phase 1+2 of keying ``job_samples`` by an integer FK to ``legacy_samples``
instead of the legacy Mongo sample string. The existing string column is already
named ``sample_id``, so it is renamed to ``sample`` to free the ``sample_id``
name for the integer FK, matching the ``sample`` / ``sample_id`` convention used
by the sample-file tables.

The migration:

- renames the legacy string column ``sample_id`` to ``sample``,
- adds a nullable ``sample_id BIGINT REFERENCES legacy_samples(id)`` column,
- backfills ``sample_id`` with a single set-based UPDATE joining the legacy
  ``sample`` string to ``legacy_samples.legacy_id``.

The backfill is idempotent (guarded by ``sample_id IS NULL``) and safe to re-run
to catch rows written during the deploy window. A ``create_sample`` job row can
outlive a deleted sample, so a legacy ``sample`` string that resolves to no
``legacy_samples`` row is left ``NULL`` rather than raising. The legacy
``sample`` column is left in place for a later cleanup revision.

Revision ID: 9f47a12a8ef6
Revises: 91b32f49a8b2
Create Date: 2026-07-07 19:39:51.071764+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "9f47a12a8ef6"
down_revision = "91b32f49a8b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("job_samples", "sample_id", new_column_name="sample")
    op.add_column(
        "job_samples",
        sa.Column(
            "sample_id",
            sa.BigInteger(),
            sa.ForeignKey("legacy_samples.id"),
            nullable=True,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE job_samples
            SET sample_id = ls.id
            FROM legacy_samples ls
            WHERE job_samples.sample_id IS NULL
              AND ls.legacy_id = job_samples.sample
            """,
        ),
    )


def downgrade() -> None:
    op.drop_column("job_samples", "sample_id")
    op.alter_column("job_samples", "sample", new_column_name="sample_id")
