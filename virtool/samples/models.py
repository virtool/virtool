from sqlalchemy import Column, DateTime, Enum, Integer, String
from sqlalchemy.sql.schema import ForeignKey, UniqueConstraint

from virtool.pg.utils import Base, SQLEnum


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


class SampleArtifact(Base):
    """
    SQL model to store sample artifacts

    """
    __tablename__ = "sample_artifacts"

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String, nullable=False)
    name_on_disk = Column(String)
    size = Column(Integer)
    type = Column(Enum(ArtifactType), nullable=False)
    uploaded_at = Column(DateTime)


class SampleReads(Base):
    """
    SQL model to store new sample reads files

    """
    __tablename__ = "sample_reads"
    __table_args__ = (UniqueConstraint("sample", "name"),)

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String(length=13), nullable=False)
    name_on_disk = Column(String, nullable=False)
    size = Column(Integer)
    upload = Column(Integer, ForeignKey('uploads.id'))
    uploaded_at = Column(DateTime)


class SampleArtifactCache(Base):
    """
    SQL model to store a cached sample artifact

    """
    __tablename__ = "sample_artifacts_cache"

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String, nullable=False)
    name_on_disk = Column(String)
    size = Column(Integer)
    type = Column(Enum(ArtifactType), nullable=False)
    uploaded_at = Column(DateTime)


class SampleReadsCache(Base):
    """
    SQL model to store cached sample reads files

    """
    __tablename__ = "sample_reads_cache"
    __tableargs__ = (UniqueConstraint("sample", "name"),)

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String(length=13), nullable=False)
    name_on_disk = Column(String, nullable=False)
    size = Column(Integer)
    uploaded_at = Column(DateTime)
