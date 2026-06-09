"""create analysis_subtractions table

Step 1 of normalizing the denormalized ``analyses.subtractions`` JSONB array
into an association table. Purely additive: creates ``analysis_subtractions``
with a composite primary key of integer foreign keys to ``analyses`` and
``subtractions``. The ``analysis_id`` cascades on analysis deletion; the
``subtraction_id`` has no delete action, preserving the invariant that an
in-use subtraction cannot be destroyed.

Backfill and the JSONB column drop are handled by downstream revisions.

Revision ID: 0536aee705e9
Revises: adea254e2c31
Create Date: 2026-06-08 22:23:58.639113+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "0536aee705e9"
down_revision = "adea254e2c31"
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
    op.create_index(
        op.f("ix_analysis_subtractions_subtraction_id"),
        "analysis_subtractions",
        ["subtraction_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_analysis_subtractions_subtraction_id"),
        table_name="analysis_subtractions",
    )
    op.drop_table("analysis_subtractions")
