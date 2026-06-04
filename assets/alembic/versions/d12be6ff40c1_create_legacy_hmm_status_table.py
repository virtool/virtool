"""create legacy hmm status table

Revision ID: d12be6ff40c1
Revises: f95b556b3adc
Create Date: 2026-06-04 21:06:03.645952+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "d12be6ff40c1"
down_revision = "f95b556b3adc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_hmm_status",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("errors", JSONB(), nullable=False),
        sa.Column("release", JSONB(), nullable=True),
        sa.Column("installed", JSONB(), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("updates", JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.CheckConstraint("id = 1", name="ck_legacy_hmm_status_singleton"),
    )


def downgrade() -> None:
    op.drop_table("legacy_hmm_status")
