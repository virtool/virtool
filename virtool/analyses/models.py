from sqlalchemy import BigInteger, Column, DateTime, Enum, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class AnalysisFormat(str, SQLEnum):
    """Enumerated type for analysis file formats"""

    sam = "sam"
    bam = "bam"
    fasta = "fasta"
    fastq = "fastq"
    csv = "csv"
    tsv = "tsv"
    json = "json"


class SQLAnalysisResult(Base):
    """SQL model to store analysis results.

    This is a temporary table and should be removed after analyses have been completely
    moved to Postgres.
    """

    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True)
    analysis_id = Column(String, unique=True)
    results = Column(JSONB)


class SQLAnalysisFile(Base):
    """SQL model to store new analysis files"""

    __tablename__ = "analysis_files"

    id = Column(Integer, primary_key=True)
    analysis = Column(String)
    description = Column(String)
    format = Column(Enum(AnalysisFormat))
    name = Column(String)
    name_on_disk = Column(String, unique=True)
    size = Column(BigInteger)
    uploaded_at = Column(DateTime)
