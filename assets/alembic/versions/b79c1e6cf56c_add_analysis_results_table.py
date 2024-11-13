"""Add analysis results table

Revision ID: b79c1e6cf56c
Revises: 141c7ecb99b7
Create Date: 2024-11-12 22:27:12.381726+00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "b79c1e6cf56c"
down_revision = "141c7ecb99b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("analysis_id", sa.String(), nullable=False, unique=True),
        sa.Column("results", JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("analysis_results")
