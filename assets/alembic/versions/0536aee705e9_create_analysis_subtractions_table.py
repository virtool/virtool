"""create analysis_subtractions table

Step 1 of normalizing the denormalized ``analyses.subtractions`` JSONB array
into an association table. Purely additive: creates ``analysis_subtractions``
with a composite primary key of integer foreign keys to ``analyses`` and
``subtractions``. The ``analysis_id`` cascades on analysis deletion; the
``subtraction_id`` has no delete action, preserving the invariant that an
in-use subtraction cannot be destroyed.

Backfill and the JSONB column drop are handled by downstream revisions.

Revision ID: 0536aee705e9
Revises: 482fb0891b9b
Create Date: 2026-06-08 22:23:58.639113+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "0536aee705e9"
down_revision = "482fb0891b9b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_subtractions",
        sa.Column("analysis_id", sa.BigInteger(), nullable=False),
        sa.Column("subtraction_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["analysis_id"],
            ["analyses.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subtraction_id"],
            ["subtractions.id"],
        ),
        sa.PrimaryKeyConstraint("analysis_id", "subtraction_id"),
    )


def downgrade() -> None:
    op.drop_table("analysis_subtractions")
