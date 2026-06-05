"""Data-layer domain for cache entries."""

import asyncio
import uuid
from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.caches.db import (
    CacheEvictionCandidate,
    select_eviction_candidates,
)
from virtool.caches.models import Cache, CacheHit
from virtool.caches.pg import CACHE_KEY_CONSTRAINT, SQLCache
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.pg.utils import extract_constraint_name
from virtool.storage.protocol import StorageBackend

LAST_ACCESSED_REFRESH_INTERVAL = timedelta(minutes=5)
"""Minimum interval between ``last_accessed_at`` refreshes."""

CACHE_EVICTION_GRACE_PERIOD = timedelta(hours=1)
"""Minimum cache age before an entry can be evicted for budget pressure."""

CACHE_EVICTION_STORAGE_DELETE_CONCURRENCY = 8
"""Maximum number of concurrent storage deletes during cache eviction."""

logger = get_logger("caches.data")


def _storage_key(uuid_: str) -> str:
    """Build a storage key under ``caches/v1/``."""
    return f"caches/v1/{uuid_}"


class CachesData(DataLayerDomain):
    name = "caches"

    def __init__(
        self,
        pg: AsyncEngine,
        storage: StorageBackend,
        storage_budget_bytes: int,
    ):
        self._pg = pg
        self._storage = storage
        self.storage_budget_bytes = storage_budget_bytes

    async def get(self, key: str) -> CacheHit:
        """Return the cache entry and lazy payload stream for ``key``.

        Refreshes ``last_accessed_at`` when it is older than
        :data:`LAST_ACCESSED_REFRESH_INTERVAL`.

        The returned data stream is lazy and is not opened until iterated.

        Raises :class:`CacheMissError` when no row matches ``key``.
        """
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            row = (
                await session.execute(select(SQLCache).where(SQLCache.key == key))
            ).scalar_one_or_none()

            if row is None:
                raise CacheMissError

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
        key: str,
        params: dict[str, Any] | None = None,
    ) -> Cache:
        """Create a cache entry for ``key``.

        Payloads are written under a fresh storage key so cleanup after a failed
        insert cannot delete another writer's object for the same logical key.

        Raises :class:`CacheAlreadyExistsError` when ``key`` already exists.
        """
        stored_params = params or {}
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

    async def _bulk_delete_cache(
        self,
        candidates: list[CacheEvictionCandidate],
    ) -> set[int]:
        """Delete cache storage objects, then remove their cache rows."""
        cache_ids = [candidate.id for candidate in candidates]

        if not cache_ids:
            return set()

        semaphore = asyncio.Semaphore(CACHE_EVICTION_STORAGE_DELETE_CONCURRENCY)

        async def delete_candidate_storage(candidate: CacheEvictionCandidate) -> None:
            async with semaphore:
                await self._storage.delete(candidate.storage_key)

        results = await asyncio.gather(
            *(delete_candidate_storage(candidate) for candidate in candidates),
            return_exceptions=True,
        )

        for result in results:
            if isinstance(result, BaseException):
                raise result

        async with AsyncSession(self._pg) as session:
            deleted_ids = {
                row.id
                for row in (
                    await session.execute(
                        delete(SQLCache)
                        .where(SQLCache.id.in_(cache_ids))
                        .returning(SQLCache.id),
                    )
                )
            }
            await session.commit()

        return deleted_ids

    async def evict_lru(self) -> None:
        """Evict least-recently used cache entries until storage is under budget."""
        now = virtool.utils.timestamp()
        candidates = await select_eviction_candidates(
            self._pg,
            self.storage_budget_bytes,
            now - CACHE_EVICTION_GRACE_PERIOD,
        )
        deleted_ids = await self._bulk_delete_cache(candidates)

        for candidate in candidates:
            if candidate.id not in deleted_ids:
                continue

            logger.info(
                "evicted cache entry",
                key=candidate.key,
                cache_type=candidate.cache_type,
                size=candidate.size,
                age=str(now - candidate.last_accessed_at),
            )
