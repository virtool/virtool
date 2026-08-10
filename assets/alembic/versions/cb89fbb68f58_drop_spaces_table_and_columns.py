"""drop spaces table and columns

Revision ID: cb89fbb68f58
Revises: 9cea546d2cd3
Create Date: 2026-08-05 17:38:47.502048+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "cb89fbb68f58"
down_revision = "9cea546d2cd3"
branch_labels = None
depends_on = None

TABLE_NAMES = ("labels", "uploads")


def upgrade() -> None:
    for table_name in TABLE_NAMES:
        op.drop_column(table_name, "space")

    op.drop_table("spaces")


def downgrade() -> None:
    op.create_table(
        "spaces",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="spaces_name_unique"),
    )

    for table_name in TABLE_NAMES:
        op.add_column(
            table_name,
            sa.Column("space", sa.Integer(), sa.ForeignKey("spaces.id"), nullable=True),
        )
