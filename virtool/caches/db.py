"""Database helpers for cache entries."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.caches.pg import SQLCache


@dataclass(frozen=True, slots=True)
class CacheEvictionCandidate:
    id: int
    key: str
    storage_key: str
    size: int
    last_accessed_at: datetime
    cache_type: str = "cache"


@dataclass(frozen=True, slots=True)
class CacheDeletionTarget:
    id: int
    storage_key: str


async def _get_total_cache_size(pg: AsyncEngine) -> int:
    """Return the total size of all cache entries."""
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(func.coalesce(func.sum(SQLCache.size), 0)),
        )

    return result.scalar_one()


async def get_cache_deletion_targets(
    pg: AsyncEngine,
    cache_ids: list[int],
) -> list[CacheDeletionTarget]:
    """Return storage deletion targets for cache IDs."""
    if not cache_ids:
        return []

    async with AsyncSession(pg) as session:
        rows = (
            await session.execute(
                select(SQLCache.id, SQLCache.storage_key).where(
                    SQLCache.id.in_(cache_ids),
                ),
            )
        ).all()

    return [
        CacheDeletionTarget(
            id=row.id,
            storage_key=row.storage_key,
        )
        for row in rows
    ]


async def bulk_delete_cache(pg: AsyncEngine, cache_ids: list[int]) -> set[int]:
    """Delete cache rows by ID and return deleted IDs."""
    if not cache_ids:
        return set()

    async with AsyncSession(pg) as session:
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


async def select_eviction_candidates(
    pg: AsyncEngine,
    storage_budget_bytes: int,
    last_accessed_before: datetime,
) -> list[CacheEvictionCandidate]:
    """Return the LRU candidates needed to get under the storage budget."""
    total_size = await _get_total_cache_size(pg)

    bytes_to_free = total_size - storage_budget_bytes

    if bytes_to_free <= 0:
        return []

    cumulative_size = func.sum(SQLCache.size).over(
        order_by=(
            SQLCache.last_accessed_at.asc(),
            SQLCache.id.asc(),
        ),
    )

    ordered_candidates = (
        select(
            SQLCache.id,
            SQLCache.key,
            SQLCache.storage_key,
            SQLCache.size,
            SQLCache.last_accessed_at,
            cumulative_size.label("cumulative_size"),
        )
        .where(SQLCache.last_accessed_at < last_accessed_before)
        .subquery()
    )

    async with AsyncSession(pg) as session:
        rows = (
            await session.execute(
                select(
                    ordered_candidates.c.id,
                    ordered_candidates.c.key,
                    ordered_candidates.c.storage_key,
                    ordered_candidates.c.size,
                    ordered_candidates.c.last_accessed_at,
                )
                .where(
                    ordered_candidates.c.cumulative_size - ordered_candidates.c.size
                    < bytes_to_free,
                )
                .order_by(
                    ordered_candidates.c.last_accessed_at.asc(),
                    ordered_candidates.c.id.asc(),
                ),
            )
        ).all()

    return [
        CacheEvictionCandidate(
            id=row.id,
            key=row.key,
            storage_key=row.storage_key,
            size=row.size,
            last_accessed_at=row.last_accessed_at,
        )
        for row in rows
    ]
