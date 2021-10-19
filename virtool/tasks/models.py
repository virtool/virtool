from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from virtool.pg.base import Base


class Task(Base):
    __tablename__ = 'tasks'

    id = Column(Integer, primary_key=True)
    complete = Column(Boolean, default=False)
    context = Column(JSONB)
    count = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False)
    error = Column(String)
    file_size = Column(Integer)
    progress = Column(Integer, default=0)
    step = Column(String)
    type = Column(String, nullable=False)
