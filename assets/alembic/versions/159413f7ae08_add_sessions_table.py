"""add sessions table

Revision ID: 159413f7ae08
Revises: 86d4e93bb0bd
Create Date: 2025-08-21 22:47:39.464528+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '159413f7ae08'
down_revision = '86d4e93bb0bd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for session types
    session_type_enum = sa.Enum("anonymous", "authenticated", "reset", name="session_type_enum")
    session_type_enum.create(op.get_bind())
    
    # Create sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("ip", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=True),
        sa.Column("reset_code", sa.String(), nullable=True),
        sa.Column("reset_remember", sa.Boolean(), nullable=True),
        sa.Column("session_type", session_type_enum, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    
    # Create indexes
    op.create_index("idx_sessions_expires_at", "sessions", ["expires_at"])
    op.create_index("idx_sessions_user_id", "sessions", ["user_id"])
    op.create_index("idx_sessions_type", "sessions", ["session_type"])


def downgrade() -> None:
    op.drop_index("idx_sessions_type", table_name="sessions")
    op.drop_index("idx_sessions_user_id", table_name="sessions")
    op.drop_index("idx_sessions_expires_at", table_name="sessions")
    op.drop_table("sessions")
    
    # Drop enum type
    session_type_enum = sa.Enum("anonymous", "authenticated", "reset", name="session_type_enum")
    session_type_enum.drop(op.get_bind())
