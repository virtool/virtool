from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from virtool_core.models.enums import MessageColor

from virtool.pg.base import Base


class SQLInstanceMessage(Base):
    __tablename__ = "instance_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    active = Column(Boolean, default=True)
    color = Column(Enum(MessageColor), nullable=False)
    message = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    user = Column(String)
