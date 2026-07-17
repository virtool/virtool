"""finalize index_files index_id

Phase 3 of keying ``index_files`` by the integer ``index_id`` FK. By this point
the add-and-backfill revision has populated ``index_id`` for every existing row
and the dual-write path sets it on new rows.

The migration:

- deletes rows orphaned by an index deleted before this migration. The legacy
  ``IndexData.delete`` hard-deletes the index and cleans its object storage but
  never deleted the ``index_files`` rows, so a deleted index leaves stale rows
  whose ``index`` matches no ``indexes`` row and whose ``index_id`` therefore
  could not be backfilled. Their files are already gone from storage, so the
  rows are dead metadata and are dropped rather than blocking the upgrade,
- raises if any row *still* has NULL ``index_id`` (tripwire; the only rows left
  are those whose ``index`` does resolve to an ``indexes`` row, so a NULL now
  means the backfill missed a live index -- a data-integrity problem),
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


DELETE_ORPHANED_ROWS_SQL = """
DELETE FROM index_files
WHERE index_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM indexes WHERE indexes.legacy_id = index_files.index
  )
"""

COUNT_NULL_INDEX_ID_SQL = """
SELECT COUNT(*) FROM index_files WHERE index_id IS NULL
"""


def upgrade() -> None:
    op.execute(sa.text(DELETE_ORPHANED_ROWS_SQL))

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
