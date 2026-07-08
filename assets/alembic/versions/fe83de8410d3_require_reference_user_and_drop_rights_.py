"""require reference user and drop rights created_at

Revision ID: fe83de8410d3
Revises: 425ac8573f1c
Create Date: 2026-07-06 17:56:09.690364+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "fe83de8410d3"
down_revision = "425ac8573f1c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("legacy_references", "user_id", nullable=False)
    op.drop_column("legacy_reference_groups", "created_at")
    op.drop_column("legacy_reference_users", "created_at")


def downgrade() -> None:
    op.add_column(
        "legacy_reference_users",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "legacy_reference_groups",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.alter_column("legacy_references", "user_id", nullable=True)
