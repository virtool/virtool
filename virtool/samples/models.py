from sqlalchemy import BigInteger, Column, DateTime, Enum, Integer, String
from sqlalchemy.sql.schema import ForeignKey, UniqueConstraint

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class ArtifactType(str, SQLEnum):
    """
    Enumerated type for possible artifact types

    """

    sam = "sam"
    bam = "bam"
    fasta = "fasta"
    fastq = "fastq"
    csv = "csv"
    tsv = "tsv"
    json = "json"


class SQLSampleArtifact(Base):
    """
    SQL model to store sample artifacts

    """

    __tablename__ = "sample_artifacts"
    __table_args__ = (UniqueConstraint("sample", "name"),)

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String, nullable=False)
    name_on_disk = Column(String)
    size = Column(BigInteger)
    type = Column(Enum(ArtifactType), nullable=False)
    uploaded_at = Column(DateTime)


class SQLSampleReads(Base):
    """
    SQL model to store new sample reads files

    """

    __tablename__ = "sample_reads"
    __table_args__ = (UniqueConstraint("sample", "name"),)

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String(length=13), nullable=False)
    name_on_disk = Column(String, nullable=False)
    size = Column(BigInteger)
    upload = Column(Integer, ForeignKey("uploads.id"))
    uploaded_at = Column(DateTime)
