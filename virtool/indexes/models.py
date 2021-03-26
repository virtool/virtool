import enum
from sqlalchemy import Column, Integer, String, Enum

from virtool.pg.utils import Base, SQLEnum


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

    id = Column(Integer, primary_key=True)
    name = Column(String)
    index = Column(String)
    type = Column(Enum(IndexType))
    size = Column(Integer)

    def __repr__(self):
        return f"<IndexFile(id={self.id}, name={self.name}, index={self.index}, type={self.type}, " \
               f"size={self.size} "
