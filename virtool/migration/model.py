from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from virtool.pg.base import Base


class SQLRevision(Base):
    """Describes an applied data revision."""

    __tablename__ = "revisions"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    revision = Column(String, unique=True)
    created_at = Column(
        DateTime,
        nullable=False,
    )
    applied_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
