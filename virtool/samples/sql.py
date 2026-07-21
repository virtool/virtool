from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    Identity,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.schema import ForeignKey, UniqueConstraint

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class ArtifactType(str, SQLEnum):
    """Enumerated type for possible artifact types"""

    sam = "sam"
    bam = "bam"
    fasta = "fasta"
    fastq = "fastq"
    csv = "csv"
    tsv = "tsv"
    json = "json"


class SQLSampleArtifact(Base):
    """SQL model to store sample artifacts"""

    __tablename__ = "sample_artifacts"
    __table_args__ = (
        UniqueConstraint("sample", "name"),
        UniqueConstraint("sample_id", "name"),
    )

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    sample_id = Column(BigInteger, ForeignKey("legacy_samples.id"))
    name = Column(String, nullable=False)
    name_on_disk = Column(String)
    size = Column(BigInteger)
    type = Column(Enum(ArtifactType), nullable=False)
    uploaded_at = Column(DateTime)


class SQLSampleReads(Base):
    """SQL model to store new sample reads files"""

    __tablename__ = "sample_reads"
    __table_args__ = (
        UniqueConstraint("sample", "name"),
        UniqueConstraint("sample_id", "name"),
    )

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    sample_id = Column(BigInteger, ForeignKey("legacy_samples.id"))
    name = Column(String(length=13), nullable=False)
    name_on_disk = Column(String, nullable=False)
    size = Column(BigInteger)
    upload = Column(Integer, ForeignKey("uploads.id"))
    uploaded_at = Column(DateTime)


class SQLSampleUpload(Base):
    """SQL model linking a sample to its input uploads."""

    __tablename__ = "sample_uploads"
    __table_args__ = (UniqueConstraint("upload_id"),)

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    sample = Column(String, nullable=False)
    sample_id = Column(BigInteger, ForeignKey("legacy_samples.id"))
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False)
    index = Column(Integer, nullable=False)


class SQLLegacySample(Base):
    """SQL model for sample metadata.

    Follows the new convention modeled on :class:`virtool.subtractions.pg.SQLSubtraction`:

    - ``BigInteger`` primary key with ``Identity(always=True)``.
    - ``legacy_id`` holds the Mongo ``_id`` and is nullable so samples created
      natively in Postgres can omit it.
    - ``user_id``, ``job_id``, and ``group_id`` are real integer foreign keys
      because ``users``, ``jobs``, and ``groups`` are already migrated. All three
      are nullable. ``job_id`` is unique: a create_sample job produces exactly one
      sample, so the reverse lookup from a job to its sample is 1:1 and replaces
      the retired ``job_samples`` link table.

    The Mongo ``workflows``, ``nuvs``, and ``pathoscope`` fields are intentionally
    omitted; workflow state is derived on read. ``labels`` and ``subtractions``
    become the ``legacy_sample_labels`` and ``legacy_sample_subtractions`` join
    tables rather than array columns. ``quality`` is stored as JSONB and never
    queried.

    ``storage_key`` is the immutable prefix a sample's objects live under
    (``samples/{storage_key}/``). It is recorded, never derived: backfilled rows
    hold their legacy id slug or old integer prefix, and natively created samples
    hold a freshly minted UUID. Recording rather than deriving it means the prefix
    survives any future change to how identities are formatted without moving a
    single object.
    """

    __tablename__ = "legacy_samples"
    __table_args__ = (
        Index(
            "ix_legacy_samples_user_id_created_at",
            "user_id",
            text("created_at DESC"),
        ),
        Index(
            "ix_legacy_samples_all_read",
            "all_read",
            postgresql_where=text("all_read = true"),
        ),
        Index(
            "ix_legacy_samples_group_read",
            "group_read",
            postgresql_where=text("group_read = true"),
        ),
        Index("ix_legacy_samples_group_id", "group_id"),
        UniqueConstraint("job_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    storage_key: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    host: Mapped[str] = mapped_column(default="")
    isolate: Mapped[str] = mapped_column(default="")
    locale: Mapped[str] = mapped_column(default="")
    notes: Mapped[str] = mapped_column(default="")
    library_type: Mapped[str]
    format: Mapped[str] = mapped_column(default="fastq")
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"))
    quality: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    paired: Mapped[bool] = mapped_column(Boolean, default=False)
    ready: Mapped[bool] = mapped_column(Boolean, default=False)
    hold: Mapped[bool] = mapped_column(Boolean, default=True)
    is_legacy: Mapped[bool] = mapped_column(Boolean, default=False)
    all_read: Mapped[bool] = mapped_column(Boolean, default=False)
    all_write: Mapped[bool] = mapped_column(Boolean, default=False)
    group_read: Mapped[bool] = mapped_column(Boolean, default=False)
    group_write: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))


class SQLLegacySampleLabel(Base):
    """Join table linking a sample to its labels."""

    __tablename__ = "legacy_sample_labels"

    sample_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_samples.id"), primary_key=True
    )
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"), primary_key=True)


class SQLLegacySampleSubtraction(Base):
    """Join table linking a sample to its default subtractions."""

    __tablename__ = "legacy_sample_subtractions"

    sample_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_samples.id"), primary_key=True
    )
    subtraction_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("subtractions.id"), primary_key=True
    )
