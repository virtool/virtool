"""drop job_samples table

Retires the ``job_samples`` link table. Now that samples live in Postgres with a
``legacy_samples.job_id`` FK guarded by a ``UNIQUE`` constraint, the
job->sample relationship is derived by inverting that scalar 1:1 edge
(``LEFT JOIN legacy_samples ON legacy_samples.job_id = jobs.id``) instead of
being stored in a dedicated table.

``downgrade`` re-creates the table with its original schema. It does not
repopulate it; the relationship is reconstructable from ``legacy_samples.job_id``.

Revision ID: 78c7c7feb2dd
Revises: 241675dea96f
Create Date: 2026-07-20 20:54:05.775896+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "78c7c7feb2dd"
down_revision = "241675dea96f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("job_samples")


def downgrade() -> None:
    op.create_table(
        "job_samples",
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("sample_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("job_id"),
    )
