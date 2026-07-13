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
    """Provider-defined timestamp of the most recent write visible to the backend.

    Semantics vary by backend and are not safe to compare across them:

    - ``MemoryStorageProvider`` records ``datetime.now(tz=UTC)`` at write time,
      using the API process clock at microsecond resolution.
    - ``ObjectProvider`` passes through the object store's server-side
      timestamp (e.g. S3 ``LastModified``), typically second-resolution and set
      by the storage server's clock rather than the API server's.

    Always UTC-aware. Do not rely on strict ordering of near-simultaneous
    writes, on sub-second precision, or on agreement between providers.
    """
