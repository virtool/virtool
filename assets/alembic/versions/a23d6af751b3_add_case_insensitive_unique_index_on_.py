"""add case insensitive unique index on user handle

Revision ID: a23d6af751b3
Revises: d34e5f8a1b2c
Create Date: 2025-10-20 23:46:28.828245+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a23d6af751b3"
down_revision = "d34e5f8a1b2c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add case-insensitive unique index on user handle."""
    op.create_index(
        "users_handle_lower_unique",
        "users",
        [sa.text("LOWER(handle)")],
        unique=True,
    )

    op.drop_constraint("users_handle_unique", "users", type_="unique")


def downgrade() -> None:
    """Remove case-insensitive index and restore original unique constraint."""
    op.create_unique_constraint("users_handle_unique", "users", ["handle"])

    op.drop_index("users_handle_lower_unique", table_name="users")
