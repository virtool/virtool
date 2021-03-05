import enum
from sqlalchemy import Column, Integer, String, Enum

from virtool.postgres import Base


class SubtractionType(str, enum.Enum):
    """
    Enumerated type for subtraction file types

    """

    fasta = "fasta"
    bowtie2 = "bowtie2"


class SubtractionFile(Base):
    """
    SQL model to store new subtraction files

    """
    __tablename__ = "subtraction_files"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    subtraction = Column(String)
    type = Column(Enum(SubtractionType))
    size = Column(Integer)

    def __repr__(self):
        return f"<SubtractionFile(id={self.id}, name={self.name}, subtraction={self.subtraction}, type={self.type}, " \
               f"size={self.size} "
