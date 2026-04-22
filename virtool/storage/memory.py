"""In-memory storage backend for testing."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo


@dataclass(frozen=True, slots=True)
class _StoredObject:
    data: bytes
    last_modified: datetime


class MemoryStorageProvider:
    """``StorageBackend`` implementation backed by an in-memory dictionary.

    Intended for use in tests. Each instance starts with an empty store.
    """

    def __init__(self) -> None:
        self._store: dict[str, _StoredObject] = {}

    async def read(self, key: str) -> AsyncIterator[bytes]:
        try:
            obj = self._store[key]
        except KeyError as exc:
            raise StorageKeyNotFoundError(key) from exc

        data = obj.data
        for i in range(0, len(data), STORAGE_CHUNK_SIZE):
            yield data[i : i + STORAGE_CHUNK_SIZE]

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        chunks = []
        async for chunk in data:
            chunks.append(chunk)

        blob = b"".join(chunks)
        self._store[key] = _StoredObject(data=blob, last_modified=datetime.now(tz=UTC))

        return len(blob)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        for key, obj in list(self._store.items()):
            if key.startswith(prefix):
                yield StorageObjectInfo(
                    key=key,
                    size=len(obj.data),
                    last_modified=obj.last_modified,
                )
