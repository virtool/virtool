"""SQL models for OTUs and their sequences."""

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLOTU(Base):
    """SQL model for an OTU.

    This is a hybrid model backing a JSONB lift of the Mongo ``otus`` collection.
    The complete Mongo document is stored verbatim in ``data`` and is the source
    of truth for reconstruction and diffs. The remaining columns are derived from
    that document and kept in sync on every write so they can be queried, filtered
    and sorted on directly.

    This model intentionally departs from the standard migration playbook. The
    primary key ``id`` is the 8-character Mongo ``_id`` string rather than a
    ``BigInteger`` identity, and there is no ``legacy_id`` column. The application
    compensates for the ``_id``/``id`` naming difference. This is deliberate
    scaffolding for a reference rewrite; normalization is skipped for now.

    ``reference_id`` is a real integer foreign key to ``legacy_references.id``
    because references are already migrated and the embedded ``reference.id`` is
    already an integer.

    ``last_indexed_version`` is the OTU's ``version`` as of the last index build that
    included it. It is promoted so index builds can select the OTUs that have changed
    since with a plain ``version IS DISTINCT FROM last_indexed_version``, rather than
    casting the value out of the ``data`` JSONB on every row. It is nullable because an
    OTU that has never been indexed carries ``None``.
    """

    __tablename__ = "legacy_otus"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    name: Mapped[str]
    abbreviation: Mapped[str] = mapped_column(default="")
    last_indexed_version: Mapped[int | None]
    reference_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_references.id"), index=True
    )
    verified: Mapped[bool]
    version: Mapped[int]

    __table_args__ = (Index("legacy_otus_name_lower", text("lower(name)"), "id"),)


class SQLSequence(Base):
    """SQL model for a sequence.

    Like :class:`SQLOTU` this is a hybrid model: the verbatim Mongo document lives
    in ``data`` and the remaining columns are promoted from it for querying.
    ``otu_id`` is a real foreign key to ``legacy_otus.id`` with ``ON DELETE
    CASCADE`` so a deleted OTU takes its sequences with it. The column is indexed
    because Postgres does not index foreign key columns automatically.

    ``isolate_id`` identifies the embedded isolate the sequence belongs to and is
    promoted so isolate-scoped operations (such as removing an isolate) can filter
    and delete on it directly. ``segment`` is the optional segment name.

    ``position`` records the sequence's insertion order within its OTU, recovering
    the Mongo natural order that the ``sequences`` collection returns. Historical
    diffs encode changes to an isolate's sequence list by index, so a joined OTU
    rebuilt from Postgres must present its sequences in this order or
    :func:`virtool.history.db.patch_to_version` will apply them to the wrong
    sequence. Only relative order matters, so deletes leave gaps rather than
    renumbering. It is nullable because rows written before the column existed have
    no position until the backfill assigns one.
    """

    __tablename__ = "legacy_sequences"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    otu_id: Mapped[str] = mapped_column(
        ForeignKey("legacy_otus.id", ondelete="CASCADE"), index=True
    )
    isolate_id: Mapped[str]
    segment: Mapped[str | None]
    position: Mapped[int | None] = mapped_column(BigInteger)

    __table_args__ = (
        Index("ix_legacy_sequences_otu_id_position", "otu_id", "position"),
    )
