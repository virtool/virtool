from datetime import datetime

from sqlalchemy import BigInteger, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base

CACHE_KEY_CONSTRAINT = "cache_key"
"""Name of the unique constraint on ``caches.key``.

Pinned here, in the migration, and in the data layer so we can distinguish
the expected duplicate-key race from any other integrity violation.
"""


class SQLCache(Base):
    """A reusable artifact addressed by an opaque caller-supplied key."""

    __tablename__ = "caches"
    __table_args__ = (UniqueConstraint("key", name=CACHE_KEY_CONSTRAINT),)

    id: Mapped[int] = mapped_column(primary_key=True)
    """Auto-incrementing surrogate primary key."""

    key: Mapped[str] = mapped_column()
    """The opaque cache key supplied by the caller."""

    storage_key: Mapped[str] = mapped_column(unique=True)
    """Full storage key for this row's storage object (e.g. ``caches/v1/<uuid>``).

    Generated at insert time from a per-write UUID so concurrent writers for
    the same cache key never target the same storage path. Stored verbatim so
    readers can hand it to the storage backend without re-deriving it.
    """

    params: Mapped[dict] = mapped_column(JSONB)
    """Diagnostic metadata recorded at insert time.

    Not used for lookup or key derivation — readers fetch by ``key`` alone.
    Persisted so a row carries a human-readable description of what produced
    it for forensic debugging.
    """

    size: Mapped[int] = mapped_column(BigInteger)
    """Size of the on-disk storage object in bytes."""

    created_at: Mapped[datetime]
    """When the row was inserted."""

    last_accessed_at: Mapped[datetime]
    """The most recent ``get`` time, coalesced by the data layer."""
