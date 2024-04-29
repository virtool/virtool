from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLLabel(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True)
    color = Column(String(length=7))
    description = Column(String, default="")
    name = Column(String, unique=True)
    space: Mapped[int] = mapped_column(ForeignKey("spaces.id"), nullable=True)
