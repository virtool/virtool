from datetime import datetime

from sqlalchemy import BigInteger, Enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.caches.types import CacheType
from virtool.pg.base import Base


class SQLCache(Base):
    """A reusable artifact keyed by a SHA-256 of its inputs."""

    __tablename__ = "caches"

    id: Mapped[int] = mapped_column(primary_key=True)
    """Auto-incrementing surrogate primary key."""

    key: Mapped[str] = mapped_column(unique=True)
    """The content-addressed SHA-256 hex digest identifying this cache."""

    blob_uuid: Mapped[str] = mapped_column(unique=True)
    """Random UUID identifying this row's blob in storage.

    Decouples the storage path from the cache ``key`` so concurrent writers
    for the same key never target the same blob path. The blob lives at
    ``caches/v1/<blob_uuid>``.
    """

    type: Mapped[CacheType] = mapped_column(Enum(CacheType))
    """The kind of artifact stored at this key."""

    params: Mapped[dict] = mapped_column(JSONB)
    """The canonical parameter dict used to derive ``key``."""

    parent_id: Mapped[str] = mapped_column(index=True)
    """The potentially external ``id`` of the parent resource (no FK).

    Indexed to support deletion based on parent ids lookups.
    """

    size: Mapped[int] = mapped_column(BigInteger)
    """Size of the on-disk blob in bytes."""

    created_at: Mapped[datetime]
    """When the row was inserted."""

    last_accessed_at: Mapped[datetime]
    """The most recent ``get`` time, time-bucketed by the repo."""
