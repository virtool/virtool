"""add sample_id to sample files

Phase 1+2 of keying ``sample_artifacts`` and ``sample_reads`` by an integer FK
to ``legacy_samples`` instead of the legacy Mongo ``sample`` string. These
subresource tables predate the migration playbook and never stored their own
Mongo ``_id``, so only the FK is added (no ``legacy_id`` retrofit).

For each table the migration:

- adds a nullable ``sample_id BIGINT REFERENCES legacy_samples(id)`` column,
- adds a parallel ``(sample_id, name)`` unique constraint alongside the existing
  ``(sample, name)`` one (NULLs don't collide, so both coexist),
- backfills ``sample_id`` with a single set-based UPDATE joining the bare
  ``sample`` string to ``legacy_samples.legacy_id``.

The backfill is idempotent (guarded by ``sample_id IS NULL``) and safe to
re-run to catch rows written during the deploy window. The legacy ``sample``
column, its ``(sample, name)`` constraint, and the ``NOT NULL`` tightening are
left for a later cleanup revision.

Revision ID: c980043c0c89
Revises: 1f4e528c2149
Create Date: 2026-07-06 21:44:40.789411+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "c980043c0c89"
down_revision = "1f4e528c2149"
branch_labels = None
depends_on = None


TABLES = ("sample_artifacts", "sample_reads")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "sample_id",
                sa.BigInteger(),
                sa.ForeignKey("legacy_samples.id"),
                nullable=True,
            ),
        )
        op.create_unique_constraint(
            f"{table}_sample_id_name_key",
            table,
            ["sample_id", "name"],
        )
        op.execute(
            sa.text(
                f"""
                UPDATE {table}
                SET sample_id = ls.id
                FROM legacy_samples ls
                WHERE {table}.sample_id IS NULL
                  AND ls.legacy_id = {table}.sample
                """,  # noqa: S608
            ),
        )


def downgrade() -> None:
    for table in TABLES:
        op.drop_constraint(
            f"{table}_sample_id_name_key",
            table,
            type_="unique",
        )
        op.drop_column(table, "sample_id")
