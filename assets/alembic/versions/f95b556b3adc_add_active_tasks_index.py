"""add active tasks index

Revision ID: f95b556b3adc
Revises: 895d6315a838
Create Date: 2026-06-03 23:31:51.980425+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f95b556b3adc"
down_revision = "895d6315a838"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Support counting active (queued and running) tasks for autoscaling without
    # scanning completed or failed rows, which accumulate unbounded.
    op.create_index(
        "idx_tasks_active",
        "tasks",
        ["acquired_at"],
        postgresql_where=sa.text("complete = false AND error IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_tasks_active", table_name="tasks")
