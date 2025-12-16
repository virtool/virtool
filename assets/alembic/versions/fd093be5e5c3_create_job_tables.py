"""create job tables

Revision ID: fd093be5e5c3
Revises: 1c57bca78c4c
Create Date: 2025-12-16 00:04:12.804806+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "fd093be5e5c3"
down_revision = "1c57bca78c4c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("acquired", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("claim", JSONB(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("key", sa.String(), nullable=True),
        sa.Column("legacy_id", sa.String(), nullable=True),
        sa.Column("pinged_at", sa.DateTime(), nullable=True),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("steps", JSONB(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("workflow", sa.String(), nullable=False),
        sa.CheckConstraint(
            "state IN ('pending', 'running', 'cancelled', 'failed', 'succeeded')",
            name="ck_jobs_state",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legacy_id"),
    )

    op.create_table(
        "job_analyses",
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("analysis_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("job_id"),
    )

    op.create_table(
        "job_indexes",
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("index_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("job_id"),
    )

    op.create_table(
        "job_samples",
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("sample_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("job_id"),
    )

    op.create_table(
        "job_subtractions",
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("subtraction_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("job_id"),
    )


def downgrade() -> None:
    op.drop_table("job_subtractions")
    op.drop_table("job_samples")
    op.drop_table("job_indexes")
    op.drop_table("job_analyses")
    op.drop_table("jobs")
