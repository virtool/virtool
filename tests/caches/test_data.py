import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.caches.data import (
    CACHE_EVICTION_GRACE_PERIOD,
    LAST_ACCESSED_REFRESH_INTERVAL,
    _storage_key,
)
from virtool.caches.db import select_eviction_candidates
from virtool.caches.pg import SQLCache
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.data.layer import DataLayer
from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


async def _create_aged_cache(
    data_layer: DataLayer,
    pg: AsyncEngine,
    key: str,
    size: int,
    now: datetime,
    last_accessed_delta: timedelta,
) -> str:
    await data_layer.caches.create(_chunker(bytes(size)), key)
    last_accessed_at = now - last_accessed_delta

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(select(SQLCache).where(SQLCache.key == key))
        ).scalar_one()
        row.last_accessed_at = last_accessed_at
        storage_key = row.storage_key
        await session.commit()

    return storage_key


TRIM_READS_KEY = "0" * 64
"""A stand-in 64-char hex key. The data layer treats keys as opaque, so any
caller-chosen string works for these tests."""

TRIM_READS_PARAMS = {
    "workflow_name": "create_sample",
    "workflow_version": "0.2.2",
    "step": "trim_reads",
    "min_length": 50,
}


class TestStorageKey:
    def test_pins_v1_namespace(self):
        assert (
            _storage_key("3d8f1c527a4e4b9c9a521c8e7d3b0a91")
            == "caches/v1/3d8f1c527a4e4b9c9a521c8e7d3b0a91"
        )


class TestCreate:
    async def test_round_trip(
        self,
        data_layer: DataLayer,
    ):
        payload = b"trimmed-reads-payload"

        created = await data_layer.caches.create(
            _chunker(payload),
            TRIM_READS_KEY,
            TRIM_READS_PARAMS,
        )

        hit = await data_layer.caches.get(TRIM_READS_KEY)

        assert hit.id == created.id
        assert hit.key == created.key == TRIM_READS_KEY
        assert hit.params == created.params == TRIM_READS_PARAMS
        assert hit.size == created.size == len(payload)
        chunks = [chunk async for chunk in hit.data]
        assert b"".join(chunks) == payload

    async def test_defaults_params_to_empty_dict(self, data_layer: DataLayer):
        created = await data_layer.caches.create(
            _chunker(b"no-diagnostics"),
            TRIM_READS_KEY,
        )

        cache = await data_layer.caches.get(TRIM_READS_KEY)

        assert created.params == {}
        assert cache.params == {}

    async def test_duplicate_key_raises_already_exists(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
    ):
        first_payload = b"first-writer"

        await data_layer.caches.create(
            _chunker(first_payload),
            TRIM_READS_KEY,
            TRIM_READS_PARAMS,
        )

        with pytest.raises(CacheAlreadyExistsError):
            await data_layer.caches.create(
                _chunker(b"second-writer-different-bytes"),
                TRIM_READS_KEY,
                TRIM_READS_PARAMS,
            )

        hit = await data_layer.caches.get(TRIM_READS_KEY)
        chunks = [chunk async for chunk in hit.data]
        assert b"".join(chunks) == first_payload

        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert len(keys) == 1

    async def test_db_failure_deletes_storage_object_and_propagates(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        mocker,
    ):
        mocker.patch.object(
            AsyncSession,
            "commit",
            side_effect=RuntimeError("simulated commit failure"),
        )

        with pytest.raises(RuntimeError, match="simulated commit failure"):
            await data_layer.caches.create(
                _chunker(b"orphan-payload"),
                TRIM_READS_KEY,
                TRIM_READS_PARAMS,
            )

        with pytest.raises(CacheMissError):
            await data_layer.caches.get(TRIM_READS_KEY)

        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert keys == []


class TestGet:
    async def test_missing_raises_cache_miss(self, data_layer: DataLayer):
        with pytest.raises(CacheMissError):
            await data_layer.caches.get(TRIM_READS_KEY)

    async def test_touches_after_refresh_interval(
        self,
        data_layer: DataLayer,
        static_time,
        mocker,
    ):
        await data_layer.caches.create(
            _chunker(b"x"),
            TRIM_READS_KEY,
            TRIM_READS_PARAMS,
        )

        bumped = (
            static_time.datetime + LAST_ACCESSED_REFRESH_INTERVAL + timedelta(seconds=1)
        )
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        hit = await data_layer.caches.get(TRIM_READS_KEY)

        assert hit.last_accessed_at == bumped


class TestEvictLRU:
    async def test_selects_only_candidates_needed_to_get_under_budget(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 65

        for key, size, age in [
            ("oldest", 10, timedelta(hours=5)),
            ("older", 20, timedelta(hours=4)),
            ("needed", 30, timedelta(hours=3)),
            ("unneeded", 40, timedelta(hours=2)),
        ]:
            await _create_aged_cache(
                data_layer,
                pg,
                key,
                size,
                static_time.datetime,
                age,
            )

        candidates = await select_eviction_candidates(
            pg,
            data_layer.caches.storage_budget_bytes,
            static_time.datetime - CACHE_EVICTION_GRACE_PERIOD,
        )

        assert [candidate.key for candidate in candidates] == [
            "oldest",
            "older",
            "needed",
        ]

    async def test_under_budget_no_op(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        mocker,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 100
        storage_key = await _create_aged_cache(
            data_layer,
            pg,
            "under_budget",
            40,
            static_time.datetime,
            timedelta(hours=2),
        )
        log_info = mocker.patch("virtool.caches.data.logger.info")
        mocker.patch(
            "virtool.caches.data.virtool.utils.timestamp",
            return_value=static_time.datetime,
        )

        await data_layer.caches.evict_lru()

        assert await data_layer.caches.get("under_budget")
        assert [chunk async for chunk in memory_storage.read(storage_key)]
        log_info.assert_not_called()

    async def test_over_budget_evicts_oldest_first_and_stops(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        mocker,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 80
        oldest_storage_key = await _create_aged_cache(
            data_layer,
            pg,
            "oldest",
            25,
            static_time.datetime,
            timedelta(hours=4),
        )
        await _create_aged_cache(
            data_layer,
            pg,
            "middle",
            30,
            static_time.datetime,
            timedelta(hours=3),
        )
        await _create_aged_cache(
            data_layer,
            pg,
            "newest",
            50,
            static_time.datetime,
            timedelta(hours=2),
        )
        mocker.patch(
            "virtool.caches.data.virtool.utils.timestamp",
            return_value=static_time.datetime,
        )

        await data_layer.caches.evict_lru()

        with pytest.raises(CacheMissError):
            await data_layer.caches.get("oldest")

        assert await data_layer.caches.get("middle")
        assert await data_layer.caches.get("newest")

        with pytest.raises(StorageKeyNotFoundError):
            [chunk async for chunk in memory_storage.read(oldest_storage_key)]

    async def test_parallel_storage_deletes_are_bounded(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        mocker,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 1

        for index in range(12):
            await _create_aged_cache(
                data_layer,
                pg,
                f"evicted_{index:02}",
                10,
                static_time.datetime,
                timedelta(hours=2, minutes=index),
            )

        mocker.patch(
            "virtool.caches.data.virtool.utils.timestamp",
            return_value=static_time.datetime,
        )
        real_delete = memory_storage.delete
        active_deletes = 0
        max_active_deletes = 0

        async def delete_storage(key: str) -> None:
            nonlocal active_deletes, max_active_deletes

            active_deletes += 1
            max_active_deletes = max(max_active_deletes, active_deletes)

            try:
                await asyncio.sleep(0.01)
                await real_delete(key)
            finally:
                active_deletes -= 1

        mocker.patch.object(memory_storage, "delete", side_effect=delete_storage)

        await data_layer.caches.evict_lru()

        assert max_active_deletes == 8

    async def test_storage_delete_failure_prevents_cache_row_deletion(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        mocker,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 1
        storage_keys = {
            key: await _create_aged_cache(
                data_layer,
                pg,
                key,
                10,
                static_time.datetime,
                timedelta(hours=2, minutes=index),
            )
            for index, key in enumerate(("failed_delete", "attempted_sibling"))
        }
        attempted_keys = []
        real_delete = memory_storage.delete

        async def delete_storage(key: str) -> None:
            attempted_keys.append(key)

            if key == storage_keys["failed_delete"]:
                raise StorageError("S3 5xx")

            await real_delete(key)

        mocker.patch(
            "virtool.caches.data.virtool.utils.timestamp",
            return_value=static_time.datetime,
        )
        mocker.patch.object(memory_storage, "delete", side_effect=delete_storage)

        with pytest.raises(StorageError, match="S3 5xx"):
            await data_layer.caches.evict_lru()

        async with AsyncSession(pg) as session:
            remaining_keys = set(
                (
                    await session.execute(
                        select(SQLCache.key).where(SQLCache.key.in_(storage_keys)),
                    )
                ).scalars(),
            )

        assert remaining_keys == set(storage_keys)
        assert set(attempted_keys) == set(storage_keys.values())

    async def test_grace_window_skips_recent_rows_when_over_budget(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        mocker,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 50
        await _create_aged_cache(
            data_layer,
            pg,
            "recent_large",
            80,
            static_time.datetime,
            timedelta(minutes=30),
        )
        await _create_aged_cache(
            data_layer,
            pg,
            "recent_small",
            50,
            static_time.datetime,
            timedelta(minutes=10),
        )
        mocker.patch(
            "virtool.caches.data.virtool.utils.timestamp",
            return_value=static_time.datetime,
        )

        await data_layer.caches.evict_lru()

        assert await data_layer.caches.get("recent_large")
        assert await data_layer.caches.get("recent_small")

    async def test_db_delete_failure_leaves_recoverable_row_after_storage_delete(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        mocker,
        static_time,
    ):
        data_layer.caches.storage_budget_bytes = 1
        storage_key = await _create_aged_cache(
            data_layer,
            pg,
            "delete_commit_fails",
            10,
            static_time.datetime,
            timedelta(hours=2),
        )
        mocker.patch(
            "virtool.caches.data.virtool.utils.timestamp",
            return_value=static_time.datetime,
        )
        mocker.patch.object(
            AsyncSession,
            "commit",
            side_effect=RuntimeError("simulated commit failure"),
        )

        with pytest.raises(RuntimeError, match="simulated commit failure"):
            await data_layer.caches.evict_lru()

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLCache).where(SQLCache.key == "delete_commit_fails")
                )
            ).scalar_one_or_none()

        assert row is not None

        with pytest.raises(StorageKeyNotFoundError):
            [chunk async for chunk in memory_storage.read(storage_key)]
