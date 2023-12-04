"""rename users table primary_group to primary_group_id

Revision ID: 8f3810c1c2c9
Revises: 4104346698df
Create Date: 2023-11-14 18:12:35.466620+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8f3810c1c2c9"
down_revision = "4104346698df"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "primary_group", new_column_name="primary_group_id")


def downgrade() -> None:
    op.alter_column("users", "primary_group_id", new_column_name="primary_group")
