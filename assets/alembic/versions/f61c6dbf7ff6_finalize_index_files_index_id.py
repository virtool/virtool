"""finalize index_files index_id

Phase 3 of keying ``index_files`` by the integer ``index_id`` FK. By this point
the add-and-backfill revision has populated ``index_id`` for every existing row
and the dual-write path sets it on new rows.

The migration:

- raises if any row still has NULL ``index_id`` (tripwire; every index file
  belongs to an index, so an unresolved reference is a data-integrity problem),
- sets ``index_id`` NOT NULL,
- drops the legacy ``(index, name)`` unique constraint (the ``(index_id, name)``
  constraint was added in ``89a96e2f4db3``).

The legacy ``index`` string column is deliberately kept; it is dropped in a
later cleanup revision once every cross-domain reference has moved to the
integer id.

``downgrade`` is reversible: it restores the old constraint and makes
``index_id`` nullable again.

Revision ID: f61c6dbf7ff6
Revises: 89a96e2f4db3
Create Date: 2026-07-17 19:59:34.610767+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "f61c6dbf7ff6"
down_revision = "89a96e2f4db3"
branch_labels = None
depends_on = None


COUNT_NULL_INDEX_ID_SQL = """
SELECT COUNT(*) FROM index_files WHERE index_id IS NULL
"""


def upgrade() -> None:
    null_count = op.get_bind().execute(sa.text(COUNT_NULL_INDEX_ID_SQL)).scalar()

    if null_count:
        msg = (
            f"{null_count} index_files row(s) have NULL index_id; "
            "refusing to set NOT NULL"
        )
        raise RuntimeError(msg)

    op.alter_column("index_files", "index_id", nullable=False)
    op.drop_constraint(
        "index_files_index_name_key",
        "index_files",
        type_="unique",
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "index_files_index_name_key",
        "index_files",
        ["index", "name"],
    )
    op.alter_column("index_files", "index_id", nullable=True)
