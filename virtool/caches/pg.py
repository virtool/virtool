from datetime import datetime

from sqlalchemy import BigInteger, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLCache(Base):
    """A reusable artifact keyed by a SHA-256 of its inputs."""

    __tablename__ = "caches"
    __table_args__ = (UniqueConstraint("key", name="cache_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    """Auto-incrementing surrogate primary key."""

    key: Mapped[str] = mapped_column()
    """The content-addressed SHA-256 hex digest identifying this cache."""

    storage_key: Mapped[str] = mapped_column(unique=True)
    """Full storage key for this row's storage object (e.g. ``caches/v1/<uuid>``).

    Generated at insert time from a per-write UUID so concurrent writers for
    the same cache key never target the same storage path. Stored verbatim so
    readers can hand it to the storage backend without re-deriving it.
    """

    type: Mapped[str] = mapped_column()
    """The kind of artifact stored at this key.

    An opaque discriminator owned by the caller. The cache module does not
    enforce a value set; callers pair each ``type`` string with a
    :class:`virtool.caches.types.BaseCacheParams` subclass that pins the
    shape of ``params``.
    """

    params: Mapped[dict] = mapped_column(JSONB)
    """The canonical parameter dict used to derive ``key``."""

    size: Mapped[int] = mapped_column(BigInteger)
    """Size of the on-disk storage object in bytes."""

    created_at: Mapped[datetime]
    """When the row was inserted."""

    last_accessed_at: Mapped[datetime]
    """The most recent ``get`` time, coalesced by the repo."""
