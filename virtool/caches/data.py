"""Data-layer domain for cache rows.

The domain owns both row lifecycle and blob lifecycle for cache entries.
Higher-level concerns (eviction, the jobs API) call into this domain rather
than touching the SQL or the filesystem directly.
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
from virtool.caches.utils import derive_key, normalize_params
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import CacheAlreadyExistsError
from virtool.pg.utils import extract_constraint_name
from virtool.storage.protocol import StorageBackend

_REQUIRED_PARAM_KEYS = ("tool_name", "tool_version")

LAST_ACCESSED_BUCKET = timedelta(minutes=5)
"""How stale ``last_accessed_at`` may be before ``get`` updates it.

A coarse bucket keeps eviction ordering useful while avoiding a write on
every read."""


_CACHE_KEY_CONSTRAINT = "cache_key"
"""Name of the unique constraint on ``caches.key``.

Pinned explicitly on both the migration and the SQLAlchemy model so this
constant, the DDL, and the ORM agree on the single name. Used to distinguish
the expected race (another writer inserted the same key first) from any other
integrity violation, which would indicate a real bug.
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
        params: dict[str, Any],
    ) -> Cache | None:
        """Return the cache row matching the derived key, or ``None``.

        ``params`` must contain ``tool_name`` and ``tool_version``; both are
        part of the key. Missing either raises :class:`ValueError`. The key is
        derived the same way as :meth:`create`, so callers pass the same
        triple.

        ``last_accessed_at`` is touched in the same transaction when the
        existing value is older than :data:`LAST_ACCESSED_BUCKET`.
        """
        missing = [k for k in _REQUIRED_PARAM_KEYS if k not in params]
        if missing:
            raise ValueError(f"params is missing required keys: {missing}")

        key = derive_key(cache_type, params, parent_id)

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
        params: dict[str, Any],
    ) -> Cache:
        """Write a cache blob and insert its row, returning the new ``Cache``.

        ``params`` must contain ``tool_name`` and ``tool_version``; both are
        part of the key and are stored inside the JSONB column rather than as
        dedicated SQL columns. Missing either raises :class:`ValueError`.

        The blob is written to ``caches/v1/<blob_uuid>`` under a per-write UUID,
        so concurrent writers for the same key never target the same path. The
        per-write UUID makes the rollback unconditionally safe — deleting our
        blob can never affect another writer's blob.

        Raises :class:`CacheAlreadyExistsError` when another writer inserted
        the same key first. The caller's blob has been deleted before the
        error is raised; the race is the expected outcome of a duplicate
        write, not a failure. Any other failure during the insert deletes the
        caller's blob and re-raises the underlying error.
        """
        missing = [k for k in _REQUIRED_PARAM_KEYS if k not in params]
        if missing:
            raise ValueError(f"params is missing required keys: {missing}")

        normalized = normalize_params(params)
        key = derive_key(cache_type, params, parent_id)
        blob_uuid = uuid.uuid4().hex
        blob_key = _blob_key(blob_uuid)

        try:
            size = await self._storage.write(blob_key, chunker)
            now = virtool.utils.timestamp()

            async with AsyncSession(self._pg, expire_on_commit=False) as session:
                try:
                    result = await session.execute(
                        insert(SQLCache)
                        .values(
                            key=key,
                            blob_uuid=blob_uuid,
                            type=cache_type,
                            params=normalized,
                            parent_id=parent_id,
                            size=size,
                            created_at=now,
                            last_accessed_at=now,
                        )
                        .returning(SQLCache.id),
                    )
                    inserted_id = result.scalar_one()
                    await session.commit()
                except IntegrityError as err:
                    if extract_constraint_name(err) == _CACHE_KEY_CONSTRAINT:
                        raise CacheAlreadyExistsError from err
                    raise
        except BaseException:
            await self._storage.delete(blob_key)
            raise

        return Cache(
            id=inserted_id,
            key=key,
            blob_uuid=blob_uuid,
            type=cache_type,
            params=normalized,
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
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
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
        async with AsyncSession(self._pg, expire_on_commit=False) as session:
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
