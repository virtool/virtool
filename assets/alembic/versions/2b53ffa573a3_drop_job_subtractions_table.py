"""drop job_subtractions table

Retires the ``job_subtractions`` link table. Now that subtractions live in
Postgres with a ``subtractions.job_id`` FK guarded by a ``UNIQUE`` constraint,
the job->subtraction relationship is derived by inverting that scalar 1:1 edge
(``LEFT JOIN subtractions ON subtractions.job_id = jobs.id``) instead of being
stored in a dedicated table.

``downgrade`` re-creates the table with its original schema. It does not
repopulate it; the relationship is reconstructable from ``subtractions.job_id``.

Revision ID: 2b53ffa573a3
Revises: 90330f98cf4e
Create Date: 2026-06-09 19:06:46.200229+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "2b53ffa573a3"
down_revision = "90330f98cf4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("job_subtractions")


def downgrade() -> None:
    op.create_table(
        "job_subtractions",
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("subtraction_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("job_id"),
    )
