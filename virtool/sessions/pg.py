from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, String, Table

from virtool.pg.base import Base

metadata = Base.metadata

sessions_table = Table(
    "sessions",
    metadata,
    Column("id", String, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    Column("ip", String, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("expires_at", DateTime, nullable=False),
    Column("token_hash", String, nullable=True),
    Column("reset_code", String, nullable=True),
    Column("reset_remember", Boolean, nullable=True),
    Column(
        "session_type",
        Enum("anonymous", "authenticated", "reset", name="session_type_enum"),
        nullable=False,
    ),
    Index("idx_sessions_expires_at", "expires_at"),
    Index("idx_sessions_user_id", "user_id"),
    Index("idx_sessions_type", "session_type"),
)