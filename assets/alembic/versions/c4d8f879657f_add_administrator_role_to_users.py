"""add administrator_role to users

Revision ID: c4d8f879657f
Revises: 86d4e93bb0bd
Create Date: 2025-09-15 20:47:49.922600+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c4d8f879657f"
down_revision = "86d4e93bb0bd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the ENUM type first
    administrator_role_enum = postgresql.ENUM(
        "full", "settings", "spaces", "users", "base", name="administratorrole"
    )
    administrator_role_enum.create(op.get_bind())

    # Then add the column using the ENUM type
    op.add_column(
        "users",
        sa.Column(
            "administrator_role",
            administrator_role_enum,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "administrator_role")
    op.execute("DROP TYPE administratorrole")
