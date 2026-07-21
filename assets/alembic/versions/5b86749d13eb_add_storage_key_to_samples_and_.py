"""add storage_key to samples and subtractions

Revision ID: 5b86749d13eb
Revises: c976a55c3382
Create Date: 2026-07-21 22:35:19.530859+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5b86749d13eb"
down_revision = "c976a55c3382"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Give samples and subtractions an immutable, recorded storage prefix instead
    # of deriving one from database identity on every read. Backfilling with each
    # row's current prefix (``legacy_id`` where present, ``id`` otherwise) reproduces
    # exactly the key its objects already live under, so no object has to move.
    for table in ("legacy_samples", "subtractions"):
        op.add_column(table, sa.Column("storage_key", sa.String(), nullable=True))
        op.execute(
            f"UPDATE {table} SET storage_key = COALESCE(legacy_id, id::text)"  # noqa: S608
        )
        op.alter_column(table, "storage_key", nullable=False)
        op.create_unique_constraint(f"uq_{table}_storage_key", table, ["storage_key"])


def downgrade() -> None:
    for table in ("legacy_samples", "subtractions"):
        op.drop_constraint(f"uq_{table}_storage_key", table, type_="unique")
        op.drop_column(table, "storage_key")
