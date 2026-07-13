"""add sequence isolate_id and segment columns and otu reference_id index

Revision ID: 5de38ebeaa78
Revises: 8bbc31ae5a8a
Create Date: 2026-07-10 20:20:06.481417+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5de38ebeaa78"
down_revision = "8bbc31ae5a8a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "legacy_sequences", sa.Column("isolate_id", sa.String(), nullable=False)
    )
    op.add_column("legacy_sequences", sa.Column("segment", sa.String(), nullable=True))
    op.create_index("ix_legacy_otus_reference_id", "legacy_otus", ["reference_id"])


def downgrade() -> None:
    op.drop_index("ix_legacy_otus_reference_id", table_name="legacy_otus")
    op.drop_column("legacy_sequences", "segment")
    op.drop_column("legacy_sequences", "isolate_id")
