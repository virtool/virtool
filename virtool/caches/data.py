"""Data-layer domain for cache entries."""

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
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

logger = get_logger("caches.data")


@dataclass(frozen=True, slots=True)
class CacheEvictionCandidate:
    id: int
    key: str
    storage_key: str
    size: int
    last_accessed_at: datetime
    cache_type: str = "cache"


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

    async def delete_by_key(self, key: str) -> bool:
        """Delete the row and storage object for ``key`` if present."""
        async with AsyncSession(self._pg) as session:
            storage_key = (
                await session.execute(
                    delete(SQLCache)
                    .where(SQLCache.key == key)
                    .returning(SQLCache.storage_key),
                )
            ).scalar_one_or_none()
            await session.commit()

        if storage_key is None:
            return False

        await self._storage.delete(storage_key)

        return True

    async def total_size(self) -> int:
        """Return the total size of all cache entries."""
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(func.coalesce(func.sum(SQLCache.size), 0))
            )

        return result.scalar_one()

    async def _select_eviction_candidates(
        self,
        last_accessed_before: datetime,
    ) -> list[CacheEvictionCandidate]:
        """Return the LRU candidates needed to get under the storage budget."""
        async with AsyncSession(self._pg) as session:
            total_size = await session.scalar(
                select(func.coalesce(func.sum(SQLCache.size), 0)),
            )

            bytes_to_free = total_size - self.storage_budget_bytes

            if bytes_to_free <= 0:
                return []

            rows = (
                await session.execute(
                    select(
                        SQLCache.id,
                        SQLCache.key,
                        SQLCache.storage_key,
                        SQLCache.size,
                        SQLCache.last_accessed_at,
                    )
                    .where(SQLCache.last_accessed_at < last_accessed_before)
                    .order_by(
                        SQLCache.last_accessed_at.asc(),
                        SQLCache.id.asc(),
                    ),
                )
            ).all()

        freed_size = 0
        candidates = []

        for row in rows:
            candidates.append(
                CacheEvictionCandidate(
                    id=row.id,
                    key=row.key,
                    storage_key=row.storage_key,
                    size=row.size,
                    last_accessed_at=row.last_accessed_at,
                ),
            )

            freed_size += row.size

            if freed_size >= bytes_to_free:
                break

        return candidates

    async def _delete_eviction_candidate(
        self, candidate: CacheEvictionCandidate
    ) -> bool:
        """Delete an eviction candidate from storage, then remove its cache row."""
        await self._storage.delete(candidate.storage_key)

        async with AsyncSession(self._pg) as session:
            deleted_id = (
                await session.execute(
                    delete(SQLCache)
                    .where(SQLCache.id == candidate.id)
                    .returning(SQLCache.id),
                )
            ).scalar_one_or_none()
            await session.commit()

        return deleted_id is not None

    async def evict_lru(self) -> None:
        """Evict least-recently used cache entries until storage is under budget."""
        now = virtool.utils.timestamp()
        candidates = await self._select_eviction_candidates(
            now - CACHE_EVICTION_GRACE_PERIOD,
        )

        for candidate in candidates:
            if not await self._delete_eviction_candidate(candidate):
                continue

            logger.info(
                "evicted cache entry",
                key=candidate.key,
                cache_type=candidate.cache_type,
                size=candidate.size,
                age=str(now - candidate.last_accessed_at),
            )
