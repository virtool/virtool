"""add user type field

Revision ID: e52b2748f384
Revises: b79c1e6cf56c
Create Date: 2024-12-03 18:03:12.062643+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e52b2748f384"
down_revision = "b79c1e6cf56c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_type_enum = postgresql.ENUM("user", "system", "unknown", name="usertype")
    user_type_enum.create(op.get_bind())

    op.add_column(
        "users",
        sa.Column(
            "type",
            user_type_enum,
            nullable=True,
        ),
    )

    op.execute("UPDATE users SET type = 'user'")

    op.alter_column("users", "type", nullable=False)


def downgrade() -> None:
    op.drop_column("users", "type")

    user_type_enum = postgresql.ENUM("user", "bot", name="usertype")
    user_type_enum.drop(op.get_bind())
