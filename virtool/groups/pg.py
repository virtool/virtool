from sqlalchemy import Integer, Column, String
from sqlalchemy.dialects.postgresql import JSONB

from virtool.pg.base import Base


class SQLGroup(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    legacy_id = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False, unique=True)
    permissions = Column(JSONB, nullable=False)
