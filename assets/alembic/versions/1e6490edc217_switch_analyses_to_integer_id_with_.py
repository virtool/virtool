"""switch analyses to integer id with legacy_id

Revision ID: 1e6490edc217
Revises: 7ea2f370163c
Create Date: 2026-06-02 17:05:57.832291+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1e6490edc217"
down_revision = "7ea2f370163c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Swap the Mongo string ``id`` primary key for an integer surrogate.

    The original ``id`` column (the Mongo ``_id``) is renamed to ``legacy_id`` and
    kept as a unique VARCHAR bridge. A new ``BIGINT GENERATED ALWAYS AS IDENTITY``
    ``id`` column becomes the primary key; existing rows are backfilled from the
    identity sequence as the column is added.
    """
    op.drop_constraint("analyses_pkey", "analyses", type_="primary")

    op.alter_column("analyses", "id", new_column_name="legacy_id")

    op.create_unique_constraint("analyses_legacy_id_key", "analyses", ["legacy_id"])

    op.add_column(
        "analyses",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
        ),
    )

    op.create_primary_key("analyses_pkey", "analyses", ["id"])


def downgrade() -> None:
    op.drop_constraint("analyses_pkey", "analyses", type_="primary")

    op.drop_column("analyses", "id")

    op.drop_constraint("analyses_legacy_id_key", "analyses", type_="unique")

    op.alter_column("analyses", "legacy_id", new_column_name="id")

    op.create_primary_key("analyses_pkey", "analyses", ["id"])
