"""add index_id to analyses

Phase 1 of keying ``analyses`` by an integer FK to ``indexes`` instead of the
legacy Mongo ``index`` string. Purely additive: adds a nullable
``index_id BIGINT REFERENCES indexes(id)`` column, leaving the existing ``index``
column intact.

No index is created on ``index_id``: the analyses read path filters by
``sample_id``, never by index, so nothing selects on this column yet.

Backfill and call-site changes are handled by downstream revisions.

Revision ID: 1f020bfe6b18
Revises: f61c6dbf7ff6
Create Date: 2026-07-17 23:37:29.297352+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "1f020bfe6b18"
down_revision = "f61c6dbf7ff6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column(
            "index_id",
            sa.BigInteger(),
            sa.ForeignKey("indexes.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("analyses", "index_id")
