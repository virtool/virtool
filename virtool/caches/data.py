"""Data-layer domain for cache rows.

Owns both row and blob lifecycle for cache entries.
"""

import asyncio
import uuid
from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.caches.models import Cache
from virtool.caches.pg import SQLCache
from virtool.caches.types import CacheType
from virtool.caches.utils import build_stored_params, derive_key
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


def _blob_key(blob_uuid: str) -> str:
    """Storage key for a cache blob under the shared ``caches/v1/`` namespace."""
    return f"caches/v1/{blob_uuid}"


class CachesData(DataLayerDomain):
    name = "caches"

    def __init__(self, pg: AsyncEngine, storage: StorageBackend):
        self._pg = pg
        self._storage = storage

    async def get(
        self,
        cache_type: CacheType,
        parent_id: str,
        tool_name: str,
        tool_version: str,
        params: dict[str, Any],
    ) -> Cache | None:
        """Return the cache row matching the derived key, or ``None``.

        Refreshes ``last_accessed_at`` when it is older than
        :data:`LAST_ACCESSED_BUCKET`.
        """
        key = derive_key(cache_type, parent_id, tool_name, tool_version, params)

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

    async def create(
        self,
        chunker: AsyncIterator[bytes],
        cache_type: CacheType,
        parent_id: str,
        tool_name: str,
        tool_version: str,
        params: dict[str, Any],
    ) -> Cache:
        """Write a cache blob and insert its row, returning the new ``Cache``.

        Blobs are written under a per-write UUID so concurrent writers for the
        same key never target the same path, making rollback unconditionally
        safe — deleting our blob can never affect another writer's.

        Raises :class:`CacheAlreadyExistsError` when another writer inserted
        the same key first; the caller's blob is deleted before the error is
        raised. Any other failure during insert also deletes the caller's blob
        before re-raising.
        """
        stored_params = build_stored_params(tool_name, tool_version, params)
        key = derive_key(cache_type, parent_id, tool_name, tool_version, params)
        blob_uuid = uuid.uuid4().hex
        blob_key = _blob_key(blob_uuid)

        try:
            size = await self._storage.write(blob_key, chunker)
            now = virtool.utils.timestamp()

            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    insert(SQLCache)
                    .values(
                        key=key,
                        blob_uuid=blob_uuid,
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
            await self._storage.delete(blob_key)
            if (
                isinstance(err, IntegrityError)
                and extract_constraint_name(err) == _CACHE_KEY_CONSTRAINT
            ):
                raise CacheAlreadyExistsError from err
            raise

        return Cache(
            id=inserted_id,
            key=key,
            blob_uuid=blob_uuid,
            type=cache_type,
            params=stored_params,
            parent_id=parent_id,
            size=size,
            created_at=now,
            last_accessed_at=now,
        )

    async def delete_by_key(self, key: str) -> None:
        """Delete the row and blob identified by ``key``.

        Both deletions are idempotent; missing row or missing blob are
        treated as already-deleted.
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                delete(SQLCache)
                .where(SQLCache.key == key)
                .returning(SQLCache.blob_uuid),
            )
            blob_uuid = result.scalar_one_or_none()
            await session.commit()

        if blob_uuid is not None:
            await self._storage.delete(_blob_key(blob_uuid))

    async def delete_by_parent(self, parent_id: str, cache_type: CacheType) -> int:
        """Delete all rows of ``cache_type`` referencing ``parent_id`` and their blobs.

        Returns the number of rows deleted.
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                delete(SQLCache)
                .where(
                    SQLCache.parent_id == parent_id,
                    SQLCache.type == cache_type,
                )
                .returning(SQLCache.blob_uuid),
            )
            blob_uuids = [row[0] for row in result.all()]
            await session.commit()

        await asyncio.gather(
            *(self._storage.delete(_blob_key(blob_uuid)) for blob_uuid in blob_uuids),
        )

        return len(blob_uuids)
