"""Storage backend implementation using the obstore library."""

from collections.abc import AsyncIterator

from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo


class ObstoreProvider:
    """StorageBackend implementation backed by any obstore ObjectStore.

    Accepts an S3Store, AzureStore, MemoryStore, or any other obstore store
    object. The caller is responsible for configuring the store.
    """

    def __init__(self, store) -> None:
        self._store = store

    async def read(self, key: str) -> AsyncIterator[bytes]:
        """Stream the contents of the object at ``key`` as chunks of bytes."""
        try:
            result = await self._store.get_async(key)
        except FileNotFoundError as exc:
            raise StorageKeyNotFoundError(key) from exc

        async for chunk in result.stream(min_chunk_size=STORAGE_CHUNK_SIZE):
            yield chunk

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        """Write streamed data to the object at ``key``."""
        size = 0

        async def _counting_iter():
            nonlocal size
            async for chunk in data:
                size += len(chunk)
                yield chunk

        try:
            await self._store.put_async(
                key,
                _counting_iter(),
                chunk_size=STORAGE_CHUNK_SIZE,
            )
        except FileNotFoundError as exc:
            raise StorageKeyNotFoundError(key) from exc
        except Exception as exc:
            raise StorageError(str(exc)) from exc

        return size

    async def delete(self, key: str) -> None:
        """Delete the object at ``key``. Idempotent."""
        try:
            await self._store.delete_async(key)
        except FileNotFoundError:
            pass
        except Exception as exc:
            raise StorageError(str(exc)) from exc

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        """List objects whose keys start with ``prefix``."""
        stream = self._store.list(prefix=prefix)

        async for chunk in stream:
            for meta in chunk:
                yield StorageObjectInfo(
                    key=meta["path"],
                    size=meta["size"],
                    last_modified=meta["last_modified"],
                )
