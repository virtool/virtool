"""Database helpers for cache entries."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
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


async def _get_total_cache_size(pg: AsyncEngine) -> int:
    """Return the total size of all cache entries."""
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(func.coalesce(func.sum(SQLCache.size), 0)),
        )

    return result.scalar_one()


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
