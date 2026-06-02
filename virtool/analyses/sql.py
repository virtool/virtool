from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

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


class SQLAnalysis(Base):
    """SQL model for analysis metadata and results.

    Column naming convention:

    - A bare column (``sample``, ``reference``, ``index``) holds a legacy Mongo
      string id and has no foreign key, because the referenced collection has
      not been migrated to Postgres.
    - An ``{entity}_id`` column is a real foreign key to an existing SQL table.

    The Mongo ``space`` field is intentionally dropped.
    """

    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    workflow: Mapped[str]
    ready: Mapped[bool]
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sample: Mapped[str] = mapped_column(index=True)
    reference: Mapped[str]
    index: Mapped[str]
    subtractions: Mapped[list] = mapped_column(JSONB, default=list)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    ml_id: Mapped[int | None] = mapped_column(
        ForeignKey("ml_model_releases.id"), nullable=True
    )


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
