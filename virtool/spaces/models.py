from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
)

from virtool.pg.base import Base


class SpaceModel(Base):
    __tablename__ = "space"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    description = Column(String)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)

