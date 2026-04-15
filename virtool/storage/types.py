"""Types for the storage abstraction."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class StorageObjectInfo:
    """Metadata for a stored object, yielded by ``StorageBackend.list()``."""

    key: str
    """The full key of the object (e.g., ``"samples/abc123/reads_1.fq.gz"``)."""

    size: int
    """The size of the object in bytes."""

    last_modified: datetime
    """When the object was last modified."""
