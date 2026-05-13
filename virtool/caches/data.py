"""Data-layer domain for cache rows.

Owns both row and storage-object lifecycle for cache entries.
"""

import asyncio
import uuid
from collections.abc import AsyncIterator
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.caches.models import Cache, CacheHit
from virtool.caches.pg import SQLCache
from virtool.caches.types import CacheParams
from virtool.caches.utils import derive_key
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import CacheAlreadyExistsError
from virtool.pg.utils import extract_constraint_name
from virtool.storage.protocol import StorageBackend

LAST_ACCESSED_BUCKET = timedelta(minutes=5)
"""Max staleness of ``last_accessed_at`` before ``get`` refreshes it.

A coarse bucket keeps eviction ordering useful without a write on every read.
"""


_CACHE_KEY_CONSTRAINT = "cache_key"
"""Name of the unique constraint on ``caches.key``.

Pinned in the migration, the SQLAlchemy model, and here so we can distinguish
the expected duplicate-key race from any other integrity violation.
"""


def _storage_key(uuid_: str) -> str:
    """Build a storage key for a new cache entry under ``caches/v1/``.

    Only used at insert time. Reads and deletes load the persisted
    ``storage_key`` column verbatim and hand it directly to the storage
    backend.
    """
    return f"caches/v1/{uuid_}"


class CachesData(DataLayerDomain):
    name = "caches"

    def __init__(self, pg: AsyncEngine, storage: StorageBackend):
        self._pg = pg
        self._storage = storage

    async def get(
        self,
        cache_type: str,
        parent_id: str,
        params: CacheParams,
    ) -> CacheHit | None:
        """Return a :class:`CacheHit` for the matching row, or ``None``.

        The returned hit carries a lazy chunker over the stored bytes; the
        underlying storage stream is not opened until the chunker is iterated.

        Refreshes ``last_accessed_at`` when it is older than
        :data:`LAST_ACCESSED_BUCKET`.
        """
        key = derive_key(cache_type, parent_id, params)

        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            row = (
                await session.execute(select(SQLCache).where(SQLCache.key == key))
            ).scalar_one_or_none()

            if row is None:
                return None

            now = virtool.utils.timestamp()

            if now - row.last_accessed_at >= LAST_ACCESSED_BUCKET:
                row.last_accessed_at = now
                await session.commit()

            return CacheHit(
                **row.to_dict(),
                data=self._storage.read(row.storage_key),
            )

    async def create(
        self,
        chunker: AsyncIterator[bytes],
        cache_type: str,
        parent_id: str,
        params: CacheParams,
    ) -> Cache:
        """Write a cache storage object and insert its row, returning the new ``Cache``.

        Storage objects are written under a per-write UUID so concurrent
        writers for the same key never target the same path, making rollback
        unconditionally safe — deleting our storage object can never affect
        another writer's.

        Raises :class:`CacheAlreadyExistsError` when another writer inserted
        the same key first; the caller's storage object is deleted before the
        error is raised. Any other failure during insert also deletes the
        caller's storage object before re-raising.
        """
        stored_params = params.dict()
        key = derive_key(cache_type, parent_id, params)
        storage_key = _storage_key(uuid.uuid4().hex)

        try:
            size = await self._storage.write(storage_key, chunker)
            now = virtool.utils.timestamp()

            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    insert(SQLCache)
                    .values(
                        key=key,
                        storage_key=storage_key,
                        type=cache_type,
                        params=stored_params,
                        parent_id=parent_id,
                        size=size,
                        created_at=now,
                        last_accessed_at=now,
                    )
                    .returning(SQLCache.id),
                )
                inserted_id = result.scalar_one()
                await session.commit()
        except BaseException as err:
            await self._storage.delete(storage_key)
            if (
                isinstance(err, IntegrityError)
                and extract_constraint_name(err) == _CACHE_KEY_CONSTRAINT
            ):
                raise CacheAlreadyExistsError from err
            raise

        return Cache(
            id=inserted_id,
            key=key,
            storage_key=storage_key,
            type=cache_type,
            params=stored_params,
            parent_id=parent_id,
            size=size,
            created_at=now,
            last_accessed_at=now,
        )

    async def delete_by_key(self, key: str) -> None:
        """Delete the row and storage object identified by ``key``.

        Both deletions are idempotent; a missing row or missing storage
        object is treated as already-deleted.
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                delete(SQLCache)
                .where(SQLCache.key == key)
                .returning(SQLCache.storage_key),
            )
            storage_key = result.scalar_one_or_none()
            await session.commit()

        if storage_key is not None:
            await self._storage.delete(storage_key)

    async def delete_by_parent(self, parent_id: str, cache_type: str) -> int:
        """Delete all rows of ``cache_type`` referencing ``parent_id`` and their storage objects.

        Returns the number of rows deleted.
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                delete(SQLCache)
                .where(
                    SQLCache.parent_id == parent_id,
                    SQLCache.type == cache_type,
                )
                .returning(SQLCache.storage_key),
            )
            storage_keys = [row[0] for row in result.all()]
            await session.commit()

        await asyncio.gather(
            *(self._storage.delete(storage_key) for storage_key in storage_keys),
        )

        return len(storage_keys)
