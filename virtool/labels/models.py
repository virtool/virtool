from sqlalchemy import Column, Integer, String

from virtool.pg.utils import Base


class Label(Base):
    __tablename__ = 'labels'

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    color = Column(String(length=7))
    description = Column(String)
