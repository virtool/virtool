from datetime import datetime
from typing import Any

from virtool.caches.types import CacheType
from virtool.models.base import BaseModel


class Cache(BaseModel):
    """A reusable artifact keyed by a SHA-256 of its inputs."""

    id: int
    key: str
    blob_uuid: str
    type: CacheType
    params: dict[str, Any]
    parent_id: str
    size: int
    created_at: datetime
    last_accessed_at: datetime
