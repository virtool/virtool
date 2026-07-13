"""create otus and sequences tables

Revision ID: 8bbc31ae5a8a
Revises: 1ffbe2dcb108
Create Date: 2026-07-10 17:59:21.484146+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "8bbc31ae5a8a"
down_revision = "1ffbe2dcb108"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_otus",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("data", JSONB(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("abbreviation", sa.String(), nullable=False),
        sa.Column("reference_id", sa.BigInteger(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["reference_id"], ["legacy_references.id"]),
    )
    op.create_index(
        "legacy_otus_name_lower", "legacy_otus", [sa.text("lower(name)"), "id"]
    )
    op.create_table(
        "legacy_sequences",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("data", JSONB(), nullable=False),
        sa.Column("otu_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["otu_id"], ["legacy_otus.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_legacy_sequences_otu_id", "legacy_sequences", ["otu_id"])


def downgrade() -> None:
    op.drop_index("ix_legacy_sequences_otu_id", table_name="legacy_sequences")
    op.drop_table("legacy_sequences")
    op.drop_index("legacy_otus_name_lower", table_name="legacy_otus")
    op.drop_table("legacy_otus")
