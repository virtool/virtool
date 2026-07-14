"""add otu last indexed version

Revision ID: c6fcaf6c86ad
Revises: f8aa696aa0d3
Create Date: 2026-07-14 21:36:08.488547+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c6fcaf6c86ad"
down_revision = "f8aa696aa0d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "legacy_otus", sa.Column("last_indexed_version", sa.Integer(), nullable=True)
    )

    # ``->>`` yields SQL NULL for a JSON null and for an absent key alike, so every
    # existing row comes out of this holding exactly what its document holds.
    op.execute(
        "UPDATE legacy_otus "
        "SET last_indexed_version = (data->>'last_indexed_version')::integer"
    )


def downgrade() -> None:
    op.drop_column("legacy_otus", "last_indexed_version")
