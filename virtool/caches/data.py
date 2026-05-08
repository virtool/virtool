"""Data-layer domain for cache rows.

The domain owns both row lifecycle and blob lifecycle for cache entries.
Higher-level concerns (eviction, the jobs API) call into this domain rather
than touching the SQL or the filesystem directly.
"""

from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.caches.models import Cache
from virtool.caches.pg import SQLCache
from virtool.caches.types import CacheType
from virtool.caches.utils import derive_key, normalize_params
from virtool.data.domain import DataLayerDomain
from virtool.storage.filesystem import FilesystemProvider

_REQUIRED_PARAM_KEYS = ("tool_name", "tool_version")

LAST_ACCESSED_BUCKET = timedelta(minutes=5)
"""How stale ``last_accessed_at`` may be before ``get`` updates it.

A coarse bucket keeps eviction ordering useful while avoiding a write on
every read."""


def _blob_key(key: str) -> str:
    """Storage key for a cache blob, sharded by the first two chars of ``key``."""
    return f"{key[:2]}/{key}"


class CachesData(DataLayerDomain):
    name = "caches"

    def __init__(self, pg: AsyncEngine, data_path: Path):
        self._pg = pg
        self._storage = FilesystemProvider(data_path / "storage" / "caches")

    async def get(self, key: str) -> Cache | None:
        """Return the cache row for ``key`` or ``None``.

        ``last_accessed_at`` is touched in the same transaction when the
        existing value is older than :data:`LAST_ACCESSED_BUCKET`.
        """
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

            return Cache(**row.to_dict())

    async def put(
        self,
        chunker: AsyncIterator[bytes],
        cache_type: CacheType,
        parent_id: str,
        params: dict[str, Any],
    ) -> tuple[Cache, bool]:
        """Write a cache blob and insert its row, returning ``(entry, inserted)``.

        ``params`` must contain ``tool_name`` and ``tool_version``; both are
        part of the key and are stored inside the JSONB column rather than as
        dedicated SQL columns. Missing either raises :class:`ValueError`.

        The blob is streamed from ``chunker`` to disk first; the row is then
        inserted with ``ON CONFLICT (key) DO NOTHING``. If two callers race
        on the same key the loser's ``inserted`` is ``False`` and it observes
        the winner's row. If the row insert raises, the blob is deleted
        before the exception propagates so the row and blob never disagree
        about existence.
        """
        missing = [k for k in _REQUIRED_PARAM_KEYS if k not in params]
        if missing:
            raise ValueError(f"params is missing required keys: {missing}")

        normalized = normalize_params(params)
        key = derive_key(cache_type, params, parent_id)
        blob_key = _blob_key(key)

        size = await self._storage.write(blob_key, chunker)

        try:
            now = virtool.utils.timestamp()

            async with AsyncSession(self._pg, expire_on_commit=False) as session:
                result = await session.execute(
                    insert(SQLCache)
                    .values(
                        key=key,
                        type=cache_type,
                        params=normalized,
                        parent_id=parent_id,
                        size=size,
                        created_at=now,
                        last_accessed_at=now,
                    )
                    .on_conflict_do_nothing(index_elements=[SQLCache.key])
                    .returning(SQLCache.id),
                )
                inserted_id = result.scalar_one_or_none()
                await session.commit()

                row = (
                    await session.execute(
                        select(SQLCache).where(SQLCache.key == key),
                    )
                ).scalar_one()
        except BaseException:
            await self._storage.delete(blob_key)
            raise

        return Cache(**row.to_dict()), inserted_id is not None

    async def delete_by_key(self, key: str) -> None:
        """Delete the row and blob identified by ``key``.

        Both deletions are idempotent; missing row or missing blob are
        treated as already-deleted.
        """
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            await session.execute(delete(SQLCache).where(SQLCache.key == key))
            await session.commit()

        await self._storage.delete(_blob_key(key))

    async def delete_for_parent(self, parent_id: str, cache_type: CacheType) -> int:
        """Delete all rows of ``cache_type`` referencing ``parent_id`` and their blobs.

        Returns the number of rows deleted.
        """
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
            result = await session.execute(
                delete(SQLCache)
                .where(
                    SQLCache.parent_id == parent_id,
                    SQLCache.type == cache_type,
                )
                .returning(SQLCache.key),
            )
            keys = [row[0] for row in result.all()]
            await session.commit()

        for key in keys:
            await self._storage.delete(_blob_key(key))

        return len(keys)
