"""Postgres-backed repository for cache rows.

The repo intentionally exposes a small surface — ``get``, ``put``,
``delete_by_key``, ``delete_for_parent``. Higher-level concerns
(eviction, blob lifecycle, the jobs API) live elsewhere and call into
this repo.
"""

from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.caches.keys import derive_key, normalize_semver
from virtool.caches.sql import SQLCache
from virtool.caches.types import CacheType

LAST_ACCESSED_BUCKET = timedelta(minutes=5)
"""How stale ``last_accessed_at`` may be before ``get`` updates it.

A coarse bucket keeps eviction ordering useful while avoiding a write on
every read."""


class CacheRepo:
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def get(self, key: str) -> SQLCache | None:
        """Return the cache row for ``key`` or ``None``.

        ``last_accessed_at`` is touched in the same transaction when the
        existing value is older than :data:`LAST_ACCESSED_BUCKET`.
        """
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            cache = (
                await session.execute(select(SQLCache).where(SQLCache.key == key))
            ).scalar_one_or_none()

            if cache is None:
                return None

            now = virtool.utils.timestamp()

            if now - cache.last_accessed_at >= LAST_ACCESSED_BUCKET:
                cache.last_accessed_at = now
                await session.commit()

            session.expunge(cache)
            return cache

    async def put(
        self,
        cache_type: CacheType,
        tool_name: str,
        tool_version: str,
        params: dict[str, Any],
        parent_id: str,
        size: int,
    ) -> SQLCache:
        """Insert a cache row, returning the row that ends up persisted.

        The insert is ``ON CONFLICT (key) DO NOTHING``: if two callers race
        with the same key, the loser silently observes the winner's row.
        """
        key = derive_key(cache_type, tool_name, tool_version, params, parent_id)
        now = virtool.utils.timestamp()

        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            await session.execute(
                insert(SQLCache)
                .values(
                    key=key,
                    type=cache_type,
                    tool_name=tool_name,
                    tool_version=normalize_semver(tool_version),
                    params=params,
                    parent_id=parent_id,
                    size=size,
                    created_at=now,
                    last_accessed_at=now,
                )
                .on_conflict_do_nothing(index_elements=[SQLCache.key]),
            )
            await session.commit()

            return (
                await session.execute(select(SQLCache).where(SQLCache.key == key))
            ).scalar_one()

    async def delete_by_key(self, key: str) -> bool:
        """Delete the row identified by ``key``.

        Returns whether a row was deleted; callers can use this to decide
        whether to attempt blob removal.
        """
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            result = await session.execute(
                delete(SQLCache).where(SQLCache.key == key),
            )
            await session.commit()
            return result.rowcount > 0

    async def delete_for_parent(self, parent_id: str) -> list[str]:
        """Delete all rows referencing ``parent_id`` and return their keys."""
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            result = await session.execute(
                delete(SQLCache)
                .where(SQLCache.parent_id == parent_id)
                .returning(SQLCache.key),
            )
            await session.commit()
            return [row[0] for row in result.all()]
