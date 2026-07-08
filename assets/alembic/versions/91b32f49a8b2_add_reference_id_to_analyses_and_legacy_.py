"""add reference_id to analyses and legacy_history

Phase 1 of keying ``analyses`` and ``legacy_history`` by an integer FK to
``legacy_references`` instead of the legacy Mongo ``reference`` string. Purely
additive: adds a nullable ``reference_id BIGINT REFERENCES legacy_references(id)``
column to each table (indexed on ``legacy_history`` where reads filter by
reference), leaving the existing ``reference`` columns intact.

Backfill and call-site changes are handled by downstream revisions.

Revision ID: 91b32f49a8b2
Revises: c980043c0c89
Create Date: 2026-07-06 23:05:12.307733+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "91b32f49a8b2"
down_revision = "c980043c0c89"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column(
            "reference_id",
            sa.BigInteger(),
            sa.ForeignKey("legacy_references.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "legacy_history",
        sa.Column(
            "reference_id",
            sa.BigInteger(),
            sa.ForeignKey("legacy_references.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_legacy_history_reference_id",
        "legacy_history",
        ["reference_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_legacy_history_reference_id", "legacy_history")
    op.drop_column("legacy_history", "reference_id")
    op.drop_column("analyses", "reference_id")
