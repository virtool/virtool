"""drop users invalidate_sessions column

The ``users.invalidate_sessions`` flag was written but never read. Session
revocation now happens by deleting session rows directly (VIR-2671), so the
column is dead and this drops it.

Revision ID: 3ba1bccd88e1
Revises: 78c7c7feb2dd
Create Date: 2026-07-20 20:54:06.489212+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "3ba1bccd88e1"
down_revision = "78c7c7feb2dd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "invalidate_sessions")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "invalidate_sessions",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column("users", "invalidate_sessions", server_default=None)
