"""add analyses sample_id

Phase 1 of keying ``analyses`` by an integer FK to ``legacy_samples`` instead
of the legacy Mongo ``sample`` string. Purely additive: adds a nullable
``sample_id BIGINT REFERENCES legacy_samples(id)`` column and an index on
``(sample_id, workflow)``, leaving the existing ``sample`` column and its index
intact.

Backfill and call-site changes are handled by downstream revisions.

Revision ID: 1f4e528c2149
Revises: fe83de8410d3
Create Date: 2026-07-06 18:47:01.194974+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "1f4e528c2149"
down_revision = "fe83de8410d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column(
            "sample_id",
            sa.BigInteger(),
            sa.ForeignKey("legacy_samples.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_analyses_sample_id_workflow",
        "analyses",
        ["sample_id", "workflow"],
    )


def downgrade() -> None:
    op.drop_index("ix_analyses_sample_id_workflow", "analyses")
    op.drop_column("analyses", "sample_id")
