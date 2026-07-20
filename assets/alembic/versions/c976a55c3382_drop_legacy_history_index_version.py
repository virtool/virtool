"""drop legacy_history index_version

Step 7 cleanup for the history migration. The ``legacy_history.index_version``
column stored a stringified copy of the index build version that was always
written and cleared together with ``index_id``. Now that ``index_id`` is an
integer foreign key to ``indexes.id``, the version is authoritative in
``indexes.version`` and read back through that join, so the stored copy is
redundant and dropped here.

A tripwire guards the drop. It fails if any row's built/unbuilt state disagrees
between ``index_id`` and ``index_version`` (exactly one is ``NULL``), or if a
built row's stored ``index_version`` is non-numeric or does not equal the joined
``indexes.version``. Any of these means the redundant copy has drifted from the
authoritative value, and dropping it would silently change what the read path
reconstructs. The numeric check is a ``CASE`` guard so the ``::bigint`` cast never
runs on a malformed value and surface a clean ``RuntimeError`` instead of an
opaque cast error.

This migration is reversible: the column is fully derivable from
``indexes.version`` and the unbuilt encoding (``index_id IS NULL``), so
``downgrade`` re-adds the nullable column and repopulates it from the join,
leaving unbuilt rows ``NULL`` exactly as they were.

Revision ID: c976a55c3382
Revises: 3ba1bccd88e1
Create Date: 2026-07-20 20:54:58.997199+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c976a55c3382"
down_revision = "3ba1bccd88e1"
branch_labels = None
depends_on = None


INCONSISTENT_SQL = r"""
SELECT count(*)
FROM legacy_history lh
LEFT JOIN indexes i ON i.id = lh.index_id
WHERE (lh.index_id IS NULL) <> (lh.index_version IS NULL)
   OR (
       lh.index_id IS NOT NULL
       AND CASE
           WHEN lh.index_version ~ '^[0-9]+$'
               THEN lh.index_version::bigint IS DISTINCT FROM i.version
           ELSE TRUE
       END
   )
"""

REPOPULATE_SQL = """
UPDATE legacy_history lh
SET index_version = i.version::text
FROM indexes i
WHERE lh.index_id = i.id
"""


def upgrade() -> None:
    inconsistent = op.get_bind().execute(sa.text(INCONSISTENT_SQL)).scalar_one()

    if inconsistent:
        raise RuntimeError(
            f"{inconsistent} legacy_history row(s) have an index_version that "
            "is non-numeric, disagrees with indexes.version, or contradicts the "
            "index_id built/unbuilt state; reconcile before dropping the column",
        )

    op.drop_column("legacy_history", "index_version")


def downgrade() -> None:
    op.add_column(
        "legacy_history",
        sa.Column("index_version", sa.String(), nullable=True),
    )

    op.execute(REPOPULATE_SQL)
