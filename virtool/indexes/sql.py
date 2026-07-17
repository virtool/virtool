from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class SQLIndex(Base):
    """SQL model for a reference index build.

    Mongo stores each index as a small, flat document with several embedded
    objects that are flattened here:

    - ``job`` and ``task`` collapse to the ``job_id`` and ``task_id`` foreign
      keys. Legacy builds carry a ``job``; builds created after the task
      migration carry a ``task``. At most one is set, enforced by the
      ``ck_indexes_job_or_task`` check constraint. A legacy build whose job was
      deleted before the jobs migration carries neither.
    - ``user`` collapses to ``user_id``.
    - ``reference`` collapses to ``reference_id``, a foreign key to
      ``legacy_references.id``.

    ``legacy_id`` holds the Mongo ``_id`` and is nullable so indexes created
    natively in Postgres can omit it. ``storage_key`` is load-bearing and
    cannot be derived from ``legacy_id``: it holds the legacy id slug for
    migrated rows and a UUID for native rows.
    """

    __tablename__ = "indexes"
    __table_args__ = (
        UniqueConstraint(
            "reference_id", "version", name="uq_indexes_reference_id_version"
        ),
        CheckConstraint(
            "num_nonnulls(job_id, task_id) <= 1", name="ck_indexes_job_or_task"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    manifest: Mapped[dict] = mapped_column(JSONB)
    ready: Mapped[bool] = mapped_column(Boolean, default=False)
    storage_key: Mapped[str] = mapped_column(unique=True)
    reference_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_references.id")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"))


class IndexType(str, SQLEnum):
    """Enumerated type for index file types."""

    json = "json"
    fasta = "fasta"
    bowtie2 = "bowtie2"


class SQLIndexFile(Base):
    """SQL model to store new index files.

    ``index`` is mid-migration: the legacy Mongo string is retained alongside the
    new ``index_id`` foreign key while readers move over. The bare ``index``
    column is dropped in a later cleanup revision. Uniqueness is now keyed on the
    integer ``(index_id, name)``; the legacy ``(index, name)`` constraint is
    dropped by the finalize revision.

    ``index_id`` cascades on delete: files belong to their index, so deleting the
    index (a hard delete, unlike the subtraction soft delete) removes its file
    rows. The object-storage files are cleaned separately by ``IndexData.delete``.
    """

    __tablename__ = "index_files"
    __table_args__ = (
        UniqueConstraint("index_id", "name", name="index_files_index_id_name_key"),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    index = Column(String, nullable=False)
    index_id = Column(
        BigInteger,
        ForeignKey("indexes.id", ondelete="CASCADE"),
        nullable=False,
    )
    type = Column(Enum(IndexType))
    size = Column(BigInteger)
