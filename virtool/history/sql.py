from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    desc,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLLegacyHistoryDiff(Base):
    """A SQL model for storing history diffs.

    This is a temporary table and should be removed after history has been completely
    reimplemented in Postgres.

    Diffs are keyed by ``history_id``, an integer foreign key to ``legacy_history.id``.
    The old string ``change_id`` column is retained during the migration and dropped in
    a later cleanup revision.
    """

    __tablename__ = "legacy_history_diff"

    id = Column(Integer, primary_key=True)
    change_id = Column(String, unique=True)
    history_id = Column(BigInteger, ForeignKey("legacy_history.id"), unique=True)
    diff = Column(JSONB)


class SQLLegacyHistory(Base):
    """SQL model for the legacy Mongo ``history`` collection.

    This is a faithful 1:1 lift of the Mongo document into Postgres. Nested Mongo
    fields are flattened into columns:

    - ``index`` is mid-migration: the legacy Mongo string column is no longer
      written now that ``index_id`` is the source of truth, and it is nullable
      until it is dropped in a later cleanup revision. A ``NULL`` ``index_id``
      encodes an unbuilt change, exactly as a ``NULL`` ``index`` did. The public
      index id is the integer ``index_id`` primary key.
    - ``otu`` is a bare string column with no foreign key by design: ``SQLOTU`` keys
      on the 8-character Mongo id and has no ``legacy_id`` column, so this already
      holds the OTU's primary key.
    - ``reference`` is mid-migration: the legacy Mongo string column is no longer
      written now that ``reference_id`` is the source of truth, and it is nullable
      until it is dropped in a later cleanup revision.
    - ``user.id`` becomes a real foreign key to ``users.id``.
    - ``otu_version`` is a string holding a stringified integer. The Mongo sentinel
      ``"removed"`` is normalized to ``NULL`` on write by
      :func:`virtool.history.db.legacy_history_values` and reconstituted on read, so
      the column never stores a sentinel.

    The index version is not stored here: it is authoritative in ``indexes.version``
    and read through the ``index_id`` join. A ``NULL`` ``index_id`` (an unbuilt change)
    reconstructs a ``None`` index on read.
    """

    __tablename__ = "legacy_history"
    __table_args__ = (
        Index("ix_legacy_history_otu_otu_version", "otu", desc("otu_version")),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    description: Mapped[str]
    method_name: Mapped[str]
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    otu: Mapped[str]
    otu_name: Mapped[str]
    otu_version: Mapped[str | None]
    reference: Mapped[str | None] = mapped_column(index=True, nullable=True)
    reference_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("legacy_references.id"),
        nullable=True,
        index=True,
    )
    index: Mapped[str | None] = mapped_column(index=True)
    index_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("indexes.id"),
        nullable=True,
        index=True,
    )
