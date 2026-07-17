"""add index_files index_id

Phase 1+2 of keying ``index_files`` by an integer FK to ``indexes`` instead of
the legacy Mongo ``index`` string.

The migration:

- adds a nullable ``index_id BIGINT REFERENCES indexes(id)`` column,
- adds a parallel ``(index_id, name)`` unique constraint alongside the existing
  ``(index, name)`` one (NULLs don't collide, so both coexist), which the
  ``upsert_index_file`` conflict target relies on,
- backfills ``index_id`` with a single set-based UPDATE joining the bare
  ``index`` string to ``indexes.legacy_id``.

The backfill is idempotent (guarded by ``index_id IS NULL``) and safe to re-run
to catch rows written during the deploy window. The ``NOT NULL`` tightening and
the drop of the legacy ``(index, name)`` constraint are left for the downstream
finalize revision; the ``index`` column itself is dropped in a later cleanup
revision.

Revision ID: 89a96e2f4db3
Revises: aaac048795ba
Create Date: 2026-07-17 19:59:33.997379+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "89a96e2f4db3"
down_revision = "aaac048795ba"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "index_files",
        sa.Column(
            "index_id",
            sa.BigInteger(),
            sa.ForeignKey("indexes.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_unique_constraint(
        "index_files_index_id_name_key",
        "index_files",
        ["index_id", "name"],
    )
    op.execute(
        sa.text(
            """
            UPDATE index_files
            SET index_id = indexes.id
            FROM indexes
            WHERE index_files.index_id IS NULL
              AND indexes.legacy_id = index_files.index
            """,
        ),
    )


def downgrade() -> None:
    op.drop_constraint(
        "index_files_index_id_name_key",
        "index_files",
        type_="unique",
    )
    op.drop_column("index_files", "index_id")
