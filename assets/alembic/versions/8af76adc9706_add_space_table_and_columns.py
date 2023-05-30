"""Add space table and columns

Revision ID: 8af76adc9706
Revises: 90bf491700cb
Create Date: 2023-02-23 14:52:40.137262

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8af76adc9706"
down_revision = "90bf491700cb"
branch_labels = None
depends_on = None

TABLE_NAMES = ("labels", "uploads")


def upgrade():
    op.create_table(
        "spaces",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    for table_name in TABLE_NAMES:
        op.add_column(
            table_name,
            sa.Column("space", sa.Integer(), sa.ForeignKey("spaces.id"), nullable=True),
        )


def downgrade():
    for table_name in TABLE_NAMES:
        op.drop_column(table_name, "space")

    op.drop_table("spaces")
