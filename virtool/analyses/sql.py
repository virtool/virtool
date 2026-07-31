from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
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

    - An ``{entity}_id`` column is a real foreign key to an existing SQL table.
    - ``sample``, ``reference`` and ``index`` are mid-migration: the legacy Mongo
      string is retained alongside the new
      ``sample_id``/``reference_id``/``index_id`` foreign key while readers move
      over. ``reference`` and ``index`` are nullable because writers that key off
      the foreign keys omit them; ``reference`` is still read as a fallback on
      rows the ``reference_id`` backfill has not reached. The bare columns are
      dropped in a later cleanup revision.

    ``index_id`` is ``NOT NULL``, so an analysis's index is always resolvable
    through the foreign key. ``reference_id`` cannot be tightened the same way
    until it is backfilled, so ``ck_analyses_reference_present`` holds the weaker
    invariant that a reference is named either by the legacy string or by the
    foreign key. Without it a writer that omits both would insert a row that
    cannot be read back.

    The Mongo ``space`` field is intentionally dropped.
    """

    __tablename__ = "analyses"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(reference, reference_id) >= 1",
            name="ck_analyses_reference_present",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    workflow: Mapped[str]
    ready: Mapped[bool]
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sample: Mapped[str] = mapped_column(index=True)
    sample_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("legacy_samples.id"),
        nullable=True,
    )
    reference: Mapped[str | None]
    reference_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("legacy_references.id"),
        nullable=True,
    )
    index: Mapped[str | None]
    index_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("indexes.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)


class SQLAnalysisSubtraction(Base):
    """Association between an analysis and a subtraction it was run against.

    Replaces the denormalized ``analyses.subtractions`` JSONB array. The
    ``subtraction_id`` foreign key has no ``ON DELETE`` action, so a subtraction
    that is still referenced by an analysis cannot be deleted, matching the prior
    invariant that an in-use subtraction is never destroyed.
    """

    __tablename__ = "analysis_subtractions"

    analysis_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("analyses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    subtraction_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("subtractions.id"),
        primary_key=True,
        index=True,
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
    analysis_id = Column(
        BigInteger,
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
    )
    description = Column(String)
    format = Column(Enum(AnalysisFormat))
    name = Column(String)
    name_on_disk = Column(String, unique=True)
    size = Column(BigInteger)
    uploaded_at = Column(DateTime)
