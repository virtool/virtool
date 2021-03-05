import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum

from virtool.postgres import Base


class AnalysisFormat(str, enum.Enum):
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

    def __repr__(self):
        return f"<AnalysisFile(id={self.id}, analysis={self.analysis}, description={self.description}, " \
               f"format={self.format}, name={self.name}, name_on_disk={self.name_on_disk}, size={self.size}, " \
               f"uploaded_at={self.uploaded_at})>"
