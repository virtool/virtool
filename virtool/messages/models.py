from sqlalchemy import Column, Integer, Boolean, Enum, String, DateTime

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class Color(str, SQLEnum):
    red = "red"
    yellow = "yellow"
    blue = "blue"
    purple = "purple"
    orange = "orange"
    grey = "grey"


class SQLInstanceMessage(Base):
    __tablename__ = "instance_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    active = Column(Boolean, default=True)
    color = Column(Enum(Color), nullable=False)
    message = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    user = Column(String)
