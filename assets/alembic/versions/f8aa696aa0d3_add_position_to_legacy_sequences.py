"""add position to legacy sequences

Revision ID: f8aa696aa0d3
Revises: 5de38ebeaa78
Create Date: 2026-07-13 18:48:13.241547+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f8aa696aa0d3"
down_revision = "5de38ebeaa78"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "legacy_sequences", sa.Column("position", sa.BigInteger(), nullable=True)
    )
    op.create_index(
        "ix_legacy_sequences_otu_id_position",
        "legacy_sequences",
        ["otu_id", "position"],
    )


def downgrade() -> None:
    op.drop_index("ix_legacy_sequences_otu_id_position", table_name="legacy_sequences")
    op.drop_column("legacy_sequences", "position")
