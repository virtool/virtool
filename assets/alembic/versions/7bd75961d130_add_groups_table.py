"""Add groups table

Revision ID: 7bd75961d130
Revises: 8af76adc9706
Create Date: 2023-06-13 23:05:15.379949+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7bd75961d130"
down_revision = "8af76adc9706"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True, unique=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("permissions", sa.ARRAY(sa.String()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("groups")
