"""drop b2c columns from users

Revision ID: bd1ffbecfce5
Revises: 998195bd5a8b
Create Date: 2026-04-20 23:11:58.061322+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "bd1ffbecfce5"
down_revision = "998195bd5a8b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "b2c_display_name")
    op.drop_column("users", "b2c_given_name")
    op.drop_column("users", "b2c_family_name")
    op.drop_column("users", "b2c_oid")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("b2c_oid", sa.VARCHAR(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "b2c_family_name",
            sa.VARCHAR(),
            server_default=sa.text("''"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "b2c_given_name",
            sa.VARCHAR(),
            server_default=sa.text("''"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "b2c_display_name",
            sa.VARCHAR(),
            server_default=sa.text("''"),
            nullable=False,
        ),
    )
