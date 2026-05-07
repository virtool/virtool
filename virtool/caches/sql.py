from datetime import datetime

from sqlalchemy import BigInteger, Enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.caches.types import CacheType
from virtool.pg.base import Base


class SQLCache(Base):
    """A reusable artifact keyed by a SHA-256 of its inputs.

    ``parent_id`` references a Mongo document by ``_id`` and is intentionally
    not a foreign key; cleanup of orphan rows is handled out-of-band.
    """

    __tablename__ = "caches"

    id: Mapped[int] = mapped_column(primary_key=True)
    """Auto-incrementing surrogate primary key."""

    key: Mapped[str] = mapped_column(unique=True)
    """The content-addressed SHA-256 hex digest identifying this cache."""

    type: Mapped[CacheType] = mapped_column(Enum(CacheType))
    """The kind of artifact stored at this key."""

    tool_name: Mapped[str]
    """The tool that produced the artifact (e.g. ``bowtie2``)."""

    tool_version: Mapped[str]
    """The normalized semver of the producing tool."""

    params: Mapped[dict] = mapped_column(JSONB)
    """The canonical parameter dict used to derive ``key``."""

    parent_id: Mapped[str]
    """The Mongo ``_id`` of the parent resource (no FK)."""

    size: Mapped[int] = mapped_column(BigInteger)
    """Size of the on-disk blob in bytes."""

    created_at: Mapped[datetime]
    """When the row was inserted."""

    last_accessed_at: Mapped[datetime]
    """The most recent ``get`` time, time-bucketed by the repo."""
