from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
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
    natively in Postgres can omit it.

    ``storage_key`` is dead. Keys were once composed from it as
    ``indexes/{storage_key}/{file name}``; each file now records its own
    complete key in ``SQLIndexFile.storage_key``. The column is retained until a
    later cleanup revision so a rolling deploy never has readers of a dropped
    column.

    ``otus_json_storage_key`` is the exception to files recording their own
    keys. The compressed OTU JSON is materialized on demand by
    ``IndexData.get_otus_json`` and deliberately has no ``index_files`` row,
    because such a row would publish it in the index's file listing. Its key
    lives here instead. It is nullable: an index that has never been asked for
    its OTU JSON has not written one, and the key is minted on first write.
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
    otus_json_storage_key: Mapped[str | None] = mapped_column(unique=True)
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
    sqlite = "sqlite"


_ALLOWED_INDEX_TYPES = ", ".join(repr(value) for value in IndexType.to_list())


class SQLIndexFile(Base):
    """SQL model to store new index files.

    ``index`` is mid-migration: the legacy Mongo string is retained alongside the
    new ``index_id`` foreign key while readers move over. It is nullable because
    writers that key off ``index_id`` omit it, and nothing reads it. The bare
    ``index`` column is dropped in a later cleanup revision. Uniqueness is now
    keyed on the integer ``(index_id, name)``; the legacy ``(index, name)``
    constraint is dropped by the finalize revision.

    ``index_id`` cascades on delete: files belong to their index, so deleting the
    index (a hard delete, unlike the subtraction soft delete) removes its file
    rows. The object-storage files are cleaned separately by ``IndexData.delete``,
    which reads their ``storage_key`` values before the cascade removes them.

    ``storage_key`` holds the file's complete object-storage key, superseding the
    per-index ``SQLIndex.storage_key`` slug that keys were previously composed
    from.
    """

    __tablename__ = "index_files"
    __table_args__ = (
        UniqueConstraint("index_id", "name", name="index_files_index_id_name_key"),
        UniqueConstraint("storage_key", name="uq_index_files_storage_key"),
        CheckConstraint(
            f"type IN ({_ALLOWED_INDEX_TYPES})",
            name="ck_index_files_type",
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    index = Column(String, nullable=True)
    index_id = Column(
        BigInteger,
        ForeignKey("indexes.id", ondelete="CASCADE"),
        nullable=False,
    )
    type = Column(String)
    size = Column(BigInteger)
    storage_key = Column(String, nullable=False)
