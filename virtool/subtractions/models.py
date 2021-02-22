import enum
from sqlalchemy import Column, Integer, String, Enum

from virtool.postgres import Base


class SubtractionType(str, enum.Enum):
    """
    Enumerated type for subtraction file types
    """

    @classmethod
    def to_list(cls):
        return [e.value for e in cls.__members__.values()]

    fasta = "fasta"
    bowtie2 = "bowtie2"


class SubtractionFile(Base):
    """
    SQL model to store new subtraction files
    """
    __tablename__ = "subtraction_files"

    id = Column(Integer, primary_key=True)
    type = Column(Enum(SubtractionType))
    name = Column(String)
    size = Column(Integer)

    def __repr__(self):
        return f"<SubtractionFile(id={self.id},type={self.type}, name={self.name}, size={self.size}"
