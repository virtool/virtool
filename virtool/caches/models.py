from datetime import datetime

from virtool.caches.types import CacheType
from virtool.models.base import BaseModel


class Cache(BaseModel):
    """A reusable artifact keyed by a SHA-256 of its inputs."""

    id: int
    key: str
    type: CacheType
    tool_name: str
    tool_version: str
    params: dict
    parent_id: str
    size: int
    created_at: datetime
    last_accessed_at: datetime
