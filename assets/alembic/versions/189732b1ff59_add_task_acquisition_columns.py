"""add task acquisition columns

Revision ID: 189732b1ff59
Revises: c4d8f879657f
Create Date: 2025-09-16 21:43:04.911902+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "189732b1ff59"
down_revision = "c4d8f879657f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns for task acquisition tracking
    op.add_column("tasks", sa.Column("acquired_at", sa.DateTime(), nullable=True))
    op.add_column("tasks", sa.Column("runner_id", sa.String(length=255), nullable=True))

    # Create index for efficient polling of unacquired tasks
    op.create_index(
        "idx_tasks_unacquired",
        "tasks",
        ["acquired_at"],
        postgresql_where=sa.text("acquired_at IS NULL"),
    )


def downgrade() -> None:
    # Drop index and columns
    op.drop_index("idx_tasks_unacquired", table_name="tasks")
    op.drop_column("tasks", "runner_id")
    op.drop_column("tasks", "acquired_at")
