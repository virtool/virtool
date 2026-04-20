"""Fallback storage router that tries a primary backend before a fallback."""

from collections.abc import AsyncIterator

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.storage.types import StorageObjectInfo


class FallbackStorageRouter:
    """Routes storage operations between a primary and a fallback backend.

    Reads try the primary first and fall back on
    :class:`~virtool.storage.errors.StorageKeyNotFoundError`. Writes always go
    to the primary. Deletes are best-effort on both. List merges and
    deduplicates results, with primary metadata taking precedence.
    """

    def __init__(
        self,
        primary: StorageBackend,
        fallback: StorageBackend,
    ) -> None:
        self._primary = primary
        self._fallback = fallback

    async def read(self, key: str) -> AsyncIterator[bytes]:
        try:
            async for chunk in self._primary.read(key):
                yield chunk
            return
        except StorageKeyNotFoundError:
            pass

        async for chunk in self._fallback.read(key):
            yield chunk

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        return await self._primary.write(key, data)

    async def delete(self, key: str) -> None:
        await self._primary.delete(key)
        await self._fallback.delete(key)

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        seen: set[str] = set()

        async for info in self._primary.list(prefix):
            seen.add(info.key)
            yield info

        async for info in self._fallback.list(prefix):
            if info.key not in seen:
                yield info
