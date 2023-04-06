from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
)

from virtool.pg.base import Base


class SQLSpace(Base):
    __tablename__ = "space"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, default="", nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
