"""drop remove from reference rights tables

Revision ID: 425ac8573f1c
Revises: a73a2668403f
Create Date: 2026-07-03 22:46:00.740595+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "425ac8573f1c"
down_revision = "a73a2668403f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("legacy_reference_groups", "remove")
    op.drop_column("legacy_reference_users", "remove")


def downgrade() -> None:
    op.add_column(
        "legacy_reference_users",
        sa.Column(
            "remove",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "legacy_reference_groups",
        sa.Column(
            "remove",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
