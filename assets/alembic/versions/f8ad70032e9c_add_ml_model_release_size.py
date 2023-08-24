"""Add ML model release size

Revision ID: f8ad70032e9c
Revises: 814389ec5021
Create Date: 2023-08-23 23:59:28.519461+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f8ad70032e9c'
down_revision = '814389ec5021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ml_model_releases",
        sa.Column("size", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("ml_model_releases", "size")
