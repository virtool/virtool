from sqlalchemy import Column, Enum, Integer, String, UniqueConstraint

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class IndexType(str, SQLEnum):
    """
    Enumerated type for index file types

    """

    json = "json"
    fasta = "fasta"
    bowtie2 = "bowtie2"


class IndexFile(Base):
    """
    SQL model to store new index files

    """
    __tablename__ = "index_files"
    __table_args__ = (UniqueConstraint("index", "name"),)

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    index = Column(String, nullable=False)
    type = Column(Enum(IndexType))
    size = Column(Integer)
