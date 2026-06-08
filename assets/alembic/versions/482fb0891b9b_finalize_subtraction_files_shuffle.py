"""finalize subtraction_files shuffle

Final schema cleanup of the ``subtraction_files`` shuffle from the legacy
``subtraction`` string column onto the integer ``subtraction_id`` FK. By this
point every row has been backfilled and all reads and writes use
``subtraction_id``.

The migration:

- raises if any row still has NULL ``subtraction_id`` (tripwire; the backfill
  populated everything and the dual-write has been setting it on new rows),
- sets ``subtraction_id`` NOT NULL,
- drops the legacy ``(subtraction, name)`` unique constraint (the
  ``(subtraction_id, name)`` constraint was added in ``e31c352fd114``),
- drops the legacy ``subtraction`` column.

``downgrade`` is reversible: it re-adds the nullable ``subtraction`` column,
restores the old constraint, and makes ``subtraction_id`` nullable again.

Revision ID: 482fb0891b9b
Revises: e31c352fd114
Create Date: 2026-06-08 21:14:11.273949+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "482fb0891b9b"
down_revision = "e31c352fd114"
branch_labels = None
depends_on = None


COUNT_NULL_SUBTRACTION_ID_SQL = """
SELECT COUNT(*) FROM subtraction_files WHERE subtraction_id IS NULL
"""


def upgrade() -> None:
    null_count = op.get_bind().execute(sa.text(COUNT_NULL_SUBTRACTION_ID_SQL)).scalar()

    if null_count:
        msg = (
            f"{null_count} subtraction_files row(s) have NULL subtraction_id; "
            "refusing to set NOT NULL"
        )
        raise RuntimeError(msg)

    op.alter_column("subtraction_files", "subtraction_id", nullable=False)
    op.drop_constraint(
        "subtraction_files_subtraction_name_key",
        "subtraction_files",
        type_="unique",
    )
    op.drop_column("subtraction_files", "subtraction")


def downgrade() -> None:
    op.add_column(
        "subtraction_files",
        sa.Column("subtraction", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.create_unique_constraint(
        "subtraction_files_subtraction_name_key",
        "subtraction_files",
        ["subtraction", "name"],
    )
    op.alter_column("subtraction_files", "subtraction_id", nullable=True)
