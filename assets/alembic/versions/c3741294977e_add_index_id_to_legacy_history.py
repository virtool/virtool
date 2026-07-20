"""add index_id to legacy_history

Phase 1 of keying ``legacy_history`` by an integer FK to ``indexes`` instead of
the legacy Mongo ``index`` string. Purely additive: adds a nullable, indexed
``index_id BIGINT REFERENCES indexes(id)`` column, leaving the existing ``index``
string column intact. A ``NULL`` ``index_id`` encodes an unbuilt change exactly as
a ``NULL`` ``index`` did.

Backfill and call-site changes are handled by downstream revisions.

Revision ID: c3741294977e
Revises: 1f020bfe6b18
Create Date: 2026-07-17 23:56:50.956574+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c3741294977e"
down_revision = "1f020bfe6b18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "legacy_history",
        sa.Column(
            "index_id",
            sa.BigInteger(),
            sa.ForeignKey("indexes.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_legacy_history_index_id",
        "legacy_history",
        ["index_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_legacy_history_index_id", "legacy_history")
    op.drop_column("legacy_history", "index_id")
