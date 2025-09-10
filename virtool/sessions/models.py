"""SQLAlchemy models for user sessions."""

from datetime import datetime
from enum import Enum

import arrow
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SessionType(str, Enum):
    """Session type enumeration."""

    anonymous = "anonymous"
    authenticated = "authenticated"
    reset = "reset"


class SQLSession(Base):
    """SQLAlchemy model for sessions stored in PostgreSQL."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    ip: Mapped[str]
    created_at: Mapped[datetime]
    expires_at: Mapped[datetime]
    token_hash: Mapped[str | None]
    reset_code: Mapped[str | None]
    reset_remember: Mapped[bool | None]
    session_type: Mapped[SessionType] = mapped_column(
        ENUM(SessionType, name="session_type_enum")
    )

    def is_expired(self) -> bool:
        """Check if this session has expired.

        :return: True if the session has expired, False otherwise
        """
        return arrow.utcnow().naive > self.expires_at

    def to_dict(self) -> dict:
        """Convert session to dictionary format matching the current Session model.

        :return: Dictionary representation of the session
        """
        session_dict = {
            "id": self.session_id,
            "ip": self.ip,
            "created_at": self.created_at,
            "authentication": None,
            "reset": None,
        }

        if (
            self.session_type == SessionType.authenticated
            and self.user_id
            and self.token_hash
        ):
            session_dict["authentication"] = {
                "user_id": str(self.user_id),
                "token": self.token_hash,
            }
        elif (
            self.session_type == SessionType.reset and self.user_id and self.reset_code
        ):
            session_dict["reset"] = {
                "user_id": str(self.user_id),
                "code": self.reset_code,
                "remember": self.reset_remember or False,
            }

        return session_dict
