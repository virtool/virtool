from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.orm import relationship

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class UploadType(str, SQLEnum):
    """
    Enumerated type for possible upload types

    """

    hmm = "hmm"
    reference = "reference"
    reads = "reads"
    subtraction = "subtraction"


class Upload(Base):
    """
    SQL table to store all new uploads

    """

    __tablename__ = "uploads"

    id: Column = Column(Integer, primary_key=True)
    created_at: Column = Column(DateTime)
    name: Column = Column(String)
    name_on_disk: Column = Column(String, unique=True)
    ready: Column = Column(Boolean, default=False, nullable=False)
    reads: Column = relationship("SampleReads", lazy="joined")
    removed: Column = Column(Boolean, default=False, nullable=False)
    removed_at: Column = Column(DateTime)
    reserved: Column = Column(Boolean, default=False, nullable=False)
    size: Column = Column(BigInteger)
    type: Column = Column(Enum(UploadType))
    user: Column = Column(String)
    uploaded_at: Column = Column(DateTime)
