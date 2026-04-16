"""The storage backend protocol."""

from collections.abc import AsyncIterator
from typing import Protocol

from virtool.storage.types import StorageObjectInfo

STORAGE_CHUNK_SIZE: int = 4 * 1024 * 1024
"""The default chunk size for storage operations in bytes (4 MiB)."""


class StorageBackend(Protocol):
    """A protocol for storage backends.

    All methods are async. Read and list return async iterators for streaming.
    Keys are ``/``-delimited strings with no leading slash (e.g.,
    ``"samples/abc123/reads_1.fq.gz"``).
    """

    async def read(self, key: str) -> AsyncIterator[bytes]:
        """Stream the contents of the object at ``key`` as chunks of bytes.

        Raises :class:`~virtool.storage.errors.StorageKeyNotFoundError` if the
        key does not exist.
        """
        ...

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        """Write streamed data to the object at ``key``.

        Accepts an async iterator of byte chunks. Creates or overwrites the
        object. Returns the total number of bytes written.
        """
        ...

    async def delete(self, key: str) -> None:
        """Delete the object at ``key``.

        Raises :class:`~virtool.storage.errors.StorageKeyNotFoundError` if the
        key does not exist.
        """
        ...

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        """List objects whose keys start with ``prefix``.

        Yields :class:`~virtool.storage.types.StorageObjectInfo` for each
        matching object.
        """
        ...
