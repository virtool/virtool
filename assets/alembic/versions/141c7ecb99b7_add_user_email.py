"""add user email

Revision ID: 141c7ecb99b7
Revises: 5df816cef12f
Create Date: 2024-01-04 18:54:23.779682+00:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "141c7ecb99b7"
down_revision = "5df816cef12f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add email column to users table."""
    op.add_column("users", sa.Column("email", sa.String(), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "email")