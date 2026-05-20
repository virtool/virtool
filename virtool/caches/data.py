"""Data-layer domain for cache rows.

Owns both row and storage-object lifecycle for cache entries.
"""

import uuid
from collections.abc import AsyncIterator
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.caches.models import Cache, CacheHit
from virtool.caches.pg import CACHE_KEY_CONSTRAINT, SQLCache
from virtool.caches.types import BaseCacheParams
from virtool.caches.utils import derive_key
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import CacheAlreadyExistsError
from virtool.pg.utils import extract_constraint_name
from virtool.storage.protocol import StorageBackend

LAST_ACCESSED_REFRESH_INTERVAL = timedelta(minutes=5)
"""Minimum interval between ``last_accessed_at`` refreshes on ``get``.

Coalescing writes at this granularity keeps eviction ordering useful without
a write on every read.
"""


def _storage_key(uuid_: str) -> str:
    """Build a storage key for a new cache entry under ``caches/v1/``.

    Only used at insert time. Reads load the persisted ``storage_key``
    column verbatim and hand it directly to the storage backend.
    """
    return f"caches/v1/{uuid_}"


class CachesData(DataLayerDomain):
    name = "caches"

    def __init__(self, pg: AsyncEngine, storage: StorageBackend):
        self._pg = pg
        self._storage = storage

    async def get(
        self,
        params: BaseCacheParams,
    ) -> CacheHit | None:
        """Return a :class:`CacheHit` for the matching row, or ``None``.

        The returned hit carries a lazy chunker over the stored bytes; the
        underlying storage stream is not opened until the chunker is iterated.

        Refreshes ``last_accessed_at`` when it is older than
        :data:`LAST_ACCESSED_REFRESH_INTERVAL`.
        """
        key = derive_key(params)

        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            row = (
                await session.execute(select(SQLCache).where(SQLCache.key == key))
            ).scalar_one_or_none()

            if row is None:
                return None

            now = virtool.utils.timestamp()

            if now - row.last_accessed_at >= LAST_ACCESSED_REFRESH_INTERVAL:
                row.last_accessed_at = now
                await session.commit()

            return CacheHit(
                **row.to_dict(),
                data=self._storage.read(row.storage_key),
            )

    async def create(
        self,
        chunker: AsyncIterator[bytes],
        params: BaseCacheParams,
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
        key = derive_key(params)
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
                        params=stored_params,
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
                and extract_constraint_name(err) == CACHE_KEY_CONSTRAINT
            ):
                raise CacheAlreadyExistsError from err
            raise

        return Cache(
            id=inserted_id,
            key=key,
            params=stored_params,
            size=size,
            created_at=now,
            last_accessed_at=now,
        )
