"""SQLAlchemy models for account API keys."""

from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLAPIKey(Base):
    """An API key used to authenticate requests on behalf of a user."""

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    hashed: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    created_at: Mapped[datetime]
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    permissions: Mapped[dict] = mapped_column(JSONB)
