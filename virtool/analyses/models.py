import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum

from virtool.postgres import Base


class AnalysisFormat(str, enum.Enum):
    """
    Enumerated type for analysis file formats

    """

    @classmethod
    def to_list(cls):
        return [e.value for e in cls.__members__.values()]

    sam = "sam"
    bam = "bam"
    fasta = "fasta"
    fastq = "fastq"
    csv = "csv"
    tsv = "tsv"
    json = "json"


ANALYSIS_FORMATS = [*AnalysisFormat.to_list(), None]


class AnalysisFile(Base):
    """
    SQL table to store new analysis files

    """
    __tablename__ = "analysis_files"

    id = Column(Integer, primary_key=True)
    analysis = Column(String)
    description = Column(String)
    format = Column(Enum(AnalysisFormat))
    name = Column(String)
    name_on_disk = Column(String, unique=True)
    size = Column(Integer)
    uploaded_at = Column(DateTime)
