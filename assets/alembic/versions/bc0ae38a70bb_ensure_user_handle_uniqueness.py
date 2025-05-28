"""ensure user handle uniqueness

Revision ID: bc0ae38a70bb
Revises: b79c1e6cf56c
Create Date: 2025-01-16 19:34:39.940579+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "bc0ae38a70bb"
down_revision = "b79c1e6cf56c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("users_handle_unique", "users", ["handle"])


def downgrade() -> None:
    op.drop_constraint("users_handle_unique", "users", type_="unique")
