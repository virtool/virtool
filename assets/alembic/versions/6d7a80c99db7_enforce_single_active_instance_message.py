"""enforce single active instance message

Revision ID: 6d7a80c99db7
Revises: c3a7e9b4d1f2
Create Date: 2026-05-25 20:35:23.852785+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "6d7a80c99db7"
down_revision = "c3a7e9b4d1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE instance_messages SET active = false
        WHERE active = true
          AND id NOT IN (SELECT MAX(id) FROM instance_messages WHERE active = true)
        """,
    )

    op.create_index(
        "instance_messages_one_active",
        "instance_messages",
        ["active"],
        unique=True,
        postgresql_where=sa.text("active = true"),
    )


def downgrade() -> None:
    op.drop_index("instance_messages_one_active", table_name="instance_messages")
