"""Object-storage backend implementation (S3, Azure Blob, etc.).

Backed by the ``obstore`` library. ``obstore`` is imported only here; no other
module in the project should reach for ``obstore`` types directly. Construct
instances through the named classmethods (:meth:`ObjectProvider.for_s3`,
:meth:`ObjectProvider.for_azure`, :meth:`ObjectProvider.for_memory`).
"""

from collections.abc import AsyncIterator
from typing import Self

import obstore as obs
from obstore.exceptions import GenericError

from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo


class ObjectProvider:
    """``StorageBackend`` implementation for object storage services.

    The underlying ``obstore`` store is an opaque handle. Use the ``for_*``
    classmethods to build a provider for a specific backend.
    """

    def __init__(self, _store: object) -> None:
        self._store = _store

    @classmethod
    def for_s3(
        cls,
        bucket: str,
        *,
        region: str | None = None,
        endpoint: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
    ) -> Self:
        """Build a provider for an S3 (or S3-compatible) bucket."""
        from obstore.store import S3Store

        kwargs: dict[str, object] = {}
        if region:
            kwargs["region"] = region
        if endpoint:
            kwargs["endpoint"] = endpoint
            kwargs["virtual_hosted_style_request"] = False
            kwargs["client_options"] = {"allow_http": True}
        if access_key_id:
            kwargs["access_key_id"] = access_key_id
        if secret_access_key:
            kwargs["secret_access_key"] = secret_access_key

        return cls(S3Store(bucket, **kwargs))

    @classmethod
    def for_azure(
        cls,
        container: str,
        *,
        account: str,
        access_key: str | None = None,
        endpoint: str | None = None,
    ) -> Self:
        """Build a provider for an Azure Blob Storage container."""
        from obstore.store import AzureStore

        kwargs: dict[str, object] = {"account_name": account}
        if access_key:
            kwargs["account_key"] = access_key
        if endpoint:
            kwargs["endpoint"] = endpoint
            kwargs["client_options"] = {"allow_http": True}

        return cls(AzureStore(container, **kwargs))

    @classmethod
    def for_memory(cls) -> Self:
        """Build a provider backed by an obstore in-memory store.

        Intended for unit tests that exercise this class's translation between
        ``obstore`` and the ``StorageBackend`` protocol. Tests that just need
        an in-memory ``StorageBackend`` should use ``MemoryStorageProvider``.
        """
        from obstore.store import MemoryStore

        return cls(MemoryStore())

    async def read(self, key: str) -> AsyncIterator[bytes]:
        """Stream the contents of the object at ``key`` as chunks of bytes."""
        try:
            result = await obs.get_async(self._store, key)
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
            await obs.put_async(
                self._store,
                key,
                _counting_iter(),
                chunk_size=STORAGE_CHUNK_SIZE,
            )
        except Exception as exc:
            raise StorageError(str(exc)) from exc

        return size

    async def delete(self, key: str) -> None:
        """Delete the object at ``key``. Idempotent."""
        try:
            await obs.delete_async(self._store, key)
        except FileNotFoundError:
            pass
        except GenericError as exc:
            # Some S3-compatible backends (e.g. Garage) return NoSuchKey on
            # delete of a missing object instead of the 204 that AWS returns.
            if "NoSuchKey" not in str(exc):
                raise StorageError(str(exc)) from exc
        except Exception as exc:
            raise StorageError(str(exc)) from exc

    async def size(self, key: str) -> int:
        """Return the size in bytes of the object at ``key``."""
        try:
            meta = await obs.head_async(self._store, key)
        except FileNotFoundError as exc:
            raise StorageKeyNotFoundError(key) from exc

        return meta["size"]

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        """List objects whose keys start with ``prefix``."""
        async for batch in obs.list(self._store, prefix=prefix):
            for meta in batch:
                yield StorageObjectInfo(
                    key=meta["path"],
                    size=meta["size"],
                    last_modified=meta["last_modified"],
                )
