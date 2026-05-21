from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from virtool.models.base import BaseModel


class Cache(BaseModel):
    """A reusable artifact addressed by an opaque caller-supplied key."""

    id: int
    key: str
    params: dict[str, Any]
    size: int
    created_at: datetime
    last_accessed_at: datetime


class CacheHit(Cache):
    """A :class:`Cache` plus a lazy byte stream over the stored payload.

    Returned by :meth:`virtool.caches.data.CachesData.get`. The ``data``
    stream is not opened until iterated.
    """

    data: AsyncIterator[bytes]

    class Config:
        arbitrary_types_allowed = True
