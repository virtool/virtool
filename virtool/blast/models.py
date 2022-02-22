from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from virtool.pg.base import Base
from virtool.tasks.models import Task


class NuVsBlast(Base):
    __tablename__ = "nuvs_blast"

    id = Column(Integer, primary_key=True)
    analysis_id = Column(String(10), nullable=False)
    sequence_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    last_checked_at = Column(DateTime, nullable=False)
    error = Column(String)
    interval = Column(Integer, default=3)
    rid = Column(String(24))
    ready = Column(Boolean, nullable=False)
    result = Column(JSON)
    task_id = Column(Integer, ForeignKey("tasks.id"))

    task = relationship(Task)

    __table_args__ = (UniqueConstraint("analysis_id", "sequence_index"),)
