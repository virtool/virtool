"""create indexes table

Revision ID: 6ffca63a8b95
Revises: c6fcaf6c86ad
Create Date: 2026-07-17 16:36:52.495637+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "6ffca63a8b95"
down_revision = "c6fcaf6c86ad"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "indexes",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("manifest", JSONB(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("reference_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legacy_id"),
        sa.UniqueConstraint("storage_key"),
        sa.UniqueConstraint(
            "reference_id", "version", name="uq_indexes_reference_id_version"
        ),
        sa.CheckConstraint(
            "num_nonnulls(job_id, task_id) = 1", name="ck_indexes_job_or_task"
        ),
        sa.ForeignKeyConstraint(["reference_id"], ["legacy_references.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
    )


def downgrade() -> None:
    op.drop_table("indexes")
