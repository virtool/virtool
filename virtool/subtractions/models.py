from sqlalchemy import Column, Enum, Integer, String, UniqueConstraint

from virtool.pg.utils import Base, SQLEnum


class SubtractionType(str, SQLEnum):
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
    __table_args__ = (UniqueConstraint("subtraction", "name"),)

    id = Column(Integer, primary_key=True)
    name = Column(String)
    subtraction = Column(String)
    type = Column(Enum(SubtractionType))
    size = Column(Integer)
