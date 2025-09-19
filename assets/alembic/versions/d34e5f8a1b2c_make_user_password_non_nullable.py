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
    """Generate random passwords for users with null passwords and make password column non-nullable."""
    # Get a database connection
    connection = op.get_bind()

    # Find all users with null passwords
    result = connection.execute(text("SELECT id FROM users WHERE password IS NULL"))

    null_password_user_ids = result.fetchall()

    # Generate secure random passwords for users with null passwords
    for (user_id,) in null_password_user_ids:
        # Generate a 32-character hex string as the random password
        random_password = secrets.token_hex(32)

        # Hash the password using bcrypt
        hashed_password = hash_password(random_password)

        # Update the user with the new hashed password
        connection.execute(
            text("UPDATE users SET password = :password WHERE id = :user_id"),
            {"password": hashed_password, "user_id": user_id},
        )

    # Now make the password column non-nullable
    op.alter_column("users", "password", nullable=False)


def downgrade() -> None:
    """Make password column nullable again."""
    op.alter_column("users", "password", nullable=True)
