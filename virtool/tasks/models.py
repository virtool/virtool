from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from virtool.postgres import Base


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
    step = Column(String, nullable=False)
    type = Column(String, nullable=False)

    def __repr__(self):
        return f"<Task(id={self.id}, complete={self.complete}, context={self.context}, " \
               f"count={self.count}, created_at={self.created_at}, error={self.error}, " \
               f"file_size={self.file_size}, progress={self.progress}, step={self.step}, type={self.type})>"
