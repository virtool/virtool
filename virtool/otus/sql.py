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
    """

    __tablename__ = "legacy_otus"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    name: Mapped[str]
    abbreviation: Mapped[str] = mapped_column(default="")
    reference_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_references.id")
    )
    verified: Mapped[bool]
    version: Mapped[int]

    __table_args__ = (Index("legacy_otus_name_lower", text("lower(name)"), "id"),)


class SQLSequence(Base):
    """SQL model for a sequence.

    Like :class:`SQLOTU` this is a hybrid model: the verbatim Mongo document lives
    in ``data`` and ``otu_id`` is the only promoted column. ``otu_id`` is a real
    foreign key to ``legacy_otus.id`` with ``ON DELETE CASCADE`` so a deleted OTU
    takes its sequences with it. The column is indexed because Postgres does not
    index foreign key columns automatically.
    """

    __tablename__ = "legacy_sequences"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    otu_id: Mapped[str] = mapped_column(
        ForeignKey("legacy_otus.id", ondelete="CASCADE"), index=True
    )
