"""add history_diffs table

Revision ID: 86d4e93bb0bd
Revises: b79c1e6cf56c
Create Date: 2025-01-08 21:57:48.140196+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "86d4e93bb0bd"
down_revision = "bc0ae38a70bb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "history_diffs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("change_id", sa.String(), nullable=False, unique=True),
        sa.Column("diff", JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("history_diffs")
