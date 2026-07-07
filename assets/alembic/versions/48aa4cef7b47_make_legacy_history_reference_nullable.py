"""make legacy history reference nullable

``legacy_history.reference`` (the legacy Mongo reference string) is no longer
written now that ``reference_id`` is the source of truth. New rows leave it
``NULL``, so the column must be nullable. It is dropped in a later cleanup
revision.

Revision ID: 48aa4cef7b47
Revises: 91b32f49a8b2
Create Date: 2026-07-07 21:14:06.497689+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "48aa4cef7b47"
down_revision = "91b32f49a8b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "legacy_history",
        "reference",
        existing_type=sa.String(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "legacy_history",
        "reference",
        existing_type=sa.String(),
        nullable=False,
    )
