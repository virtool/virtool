from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, BigInteger
from sqlalchemy.orm import relationship

from virtool.pg.utils import Base, SQLEnum


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

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime)
    name = Column(String)
    name_on_disk = Column(String, unique=True)
    ready = Column(Boolean, default=False, nullable=False)
    reads = relationship("SampleReads", lazy="joined")
    removed = Column(Boolean, default=False, nullable=False)
    removed_at = Column(DateTime)
    reserved = Column(Boolean, default=False, nullable=False)
    size = Column(BigInteger)
    type = Column(Enum(UploadType))
    user = Column(String)
    uploaded_at = Column(DateTime)
