from sqlalchemy import BigInteger, Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLTask(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    acquired_at = Column(DateTime, nullable=True)
    complete = Column(Boolean, default=False)
    context = Column(JSONB)
    count = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False)
    error = Column(String)
    file_size = Column(BigInteger)
    progress = Column(Integer, default=0)
    runner_id = Column(String(255), nullable=True)
    step = Column(String)
    type = Column(String, nullable=False)
