"""Fix group permission type

Revision ID: 011389a5ae19
Revises: 7bd75961d130
Create Date: 2023-06-22 00:14:04.248267+00:00

Fix incorrect column type from previous migration.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "011389a5ae19"
down_revision = "7bd75961d130"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("groups", "permissions")
    op.add_column("groups", sa.Column("permissions", sa.JSON(), nullable=False))


def downgrade() -> None:
    op.drop_column("groups", "permissions")
    op.add_column(
        "groups", sa.Column("permissions", sa.ARRAY(sa.String()), nullable=False)
    )
