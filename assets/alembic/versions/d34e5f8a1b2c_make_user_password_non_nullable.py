"""make user password non-nullable

Revision ID: d34e5f8a1b2c
Revises: 189732b1ff59
Create Date: 2025-09-19 16:23:42.000000+00:00

"""

import secrets

import bcrypt
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "d34e5f8a1b2c"
down_revision = "189732b1ff59"
branch_labels = None
depends_on = None


def hash_password(password: str) -> bytes:
    """Salt and hash a unicode password. Uses bcrypt.

    :param password: a password string to salt and hash
    :return: a salt and hashed password

    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))


def upgrade() -> None:
    """Make password column non-nullable.

    For users with a null password column, generate a random password the can be reset
    by an administrator.
    """
    connection = op.get_bind()

    result = connection.execute(text("SELECT id FROM users WHERE password IS NULL"))

    null_password_user_ids = result.fetchall()

    for (user_id,) in null_password_user_ids:
        random_password = secrets.token_hex(32)

        hashed_password = hash_password(random_password)

        connection.execute(
            text("UPDATE users SET password = :password WHERE id = :user_id"),
            {"password": hashed_password, "user_id": user_id},
        )

    op.alter_column("users", "password", nullable=False)


def downgrade() -> None:
    """Make password column nullable again."""
    op.alter_column("users", "password", nullable=True)
