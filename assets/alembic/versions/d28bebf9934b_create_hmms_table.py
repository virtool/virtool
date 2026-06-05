"""create hmms table

Revision ID: d28bebf9934b
Revises: d12be6ff40c1
Create Date: 2026-06-04 23:00:27.576440+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "d28bebf9934b"
down_revision = "d12be6ff40c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hmms",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True),
        sa.Column("cluster", sa.Integer(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("length", sa.Integer(), nullable=False),
        sa.Column("mean_entropy", sa.Float(), nullable=False),
        sa.Column("total_entropy", sa.Float(), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False),
        sa.Column("names", JSONB(), nullable=False),
        sa.Column("families", JSONB(), nullable=False),
        sa.Column("genera", JSONB(), nullable=False),
        sa.Column("entries", JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legacy_id"),
    )


def downgrade() -> None:
    op.drop_table("hmms")
