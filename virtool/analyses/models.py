from sqlalchemy import Column, Integer, String, DateTime, Enum

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class AnalysisFormat(str, SQLEnum):
    """
    Enumerated type for analysis file formats

    """

    sam = "sam"
    bam = "bam"
    fasta = "fasta"
    fastq = "fastq"
    csv = "csv"
    tsv = "tsv"
    json = "json"


class AnalysisFile(Base):
    """
    SQL model to store new analysis files

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
