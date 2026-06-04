"""add subtraction_files subtraction_id

Phase 1 of keying ``subtraction_files`` by an integer FK to ``subtractions``
instead of the legacy Mongo ``subtraction`` string. Purely additive: adds a
nullable ``subtraction_id BIGINT REFERENCES subtractions(id)`` column,
leaving the existing ``subtraction`` column and its unique constraint intact.

Backfill, sync trigger, and call-site changes are handled by downstream
revisions.

Revision ID: 895d6315a838
Revises: f4624eb353b7
Create Date: 2026-06-03 20:44:11.573199+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "895d6315a838"
down_revision = "f4624eb353b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subtraction_files",
        sa.Column(
            "subtraction_id",
            sa.BigInteger(),
            sa.ForeignKey("subtractions.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("subtraction_files", "subtraction_id")
