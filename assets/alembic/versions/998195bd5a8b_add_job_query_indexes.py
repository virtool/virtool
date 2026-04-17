"""add job query indexes

Revision ID: 998195bd5a8b
Revises: fd093be5e5c3
Create Date: 2026-04-17 00:00:00.000000+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "998195bd5a8b"
down_revision = "fd093be5e5c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_jobs_workflow_state",
        "jobs",
        ["workflow", "state"],
    )
    op.create_index(
        "ix_jobs_state_created_at",
        "jobs",
        ["state", "created_at"],
    )
    op.create_index(
        "ix_jobs_user_id_state",
        "jobs",
        ["user_id", "state"],
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_user_id_state", table_name="jobs")
    op.drop_index("ix_jobs_state_created_at", table_name="jobs")
    op.drop_index("ix_jobs_workflow_state", table_name="jobs")
