"""add sessions table

Revision ID: 1c57bca78c4c
Revises: a23d6af751b3
Create Date: 2025-12-02 20:49:01.189334+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1c57bca78c4c"
down_revision = "a23d6af751b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("ip", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=True),
        sa.Column("reset_code", sa.String(), nullable=True),
        sa.Column("reset_remember", sa.Boolean(), nullable=True),
        sa.Column(
            "session_type",
            sa.Enum("anonymous", "authenticated", "reset", name="session_type_enum"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # Create indexes
    op.create_index("idx_sessions_session_id", "sessions", ["session_id"], unique=True)
    op.create_index("idx_sessions_expires_at", "sessions", ["expires_at"])
    op.create_index("idx_sessions_user_id", "sessions", ["user_id"])
    op.create_index("idx_sessions_type", "sessions", ["session_type"])


def downgrade() -> None:
    op.drop_index("idx_sessions_type", table_name="sessions")
    op.drop_index("idx_sessions_user_id", table_name="sessions")
    op.drop_index("idx_sessions_expires_at", table_name="sessions")
    op.drop_index("idx_sessions_session_id", table_name="sessions")
    op.drop_table("sessions")
    sa.Enum(name="session_type_enum").drop(op.get_bind(), checkfirst=True)
