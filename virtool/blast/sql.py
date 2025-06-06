from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from virtool.pg.base import Base
from virtool.tasks.sql import SQLTask


class SQLNuVsBlast(Base):
    __tablename__ = "nuvs_blast"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[str]
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

    task = relationship(SQLTask)

    __table_args__ = (UniqueConstraint("analysis_id", "sequence_index"),)
