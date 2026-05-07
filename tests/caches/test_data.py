from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.caches.data import LAST_ACCESSED_BUCKET, CachesData
from virtool.caches.keys import derive_key
from virtool.caches.sql import SQLCache
from virtool.caches.types import CacheType


@pytest.fixture
def caches(pg: AsyncEngine) -> CachesData:
    return CachesData(pg)


async def _read_row(pg: AsyncEngine, key: str) -> SQLCache | None:
    async with AsyncSession(pg) as session:
        return (
            await session.execute(select(SQLCache).where(SQLCache.key == key))
        ).scalar_one_or_none()


class TestPut:
    async def test_inserts_row(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
    ):
        cache = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 50},
            "sample_alpha",
            size=1024,
        )

        assert cache.key == derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 50},
            "sample_alpha",
        )
        assert cache.size == 1024
        assert cache.tool_version == "0.23.4"
        assert cache.created_at == static_time.datetime
        assert cache.last_accessed_at == static_time.datetime

        row = await _read_row(pg, cache.key)
        assert row is not None
        assert row.id == cache.id

    async def test_normalizes_stored_version(
        self,
        caches: CachesData,
        static_time,
    ):
        cache = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "v0.23.4+build.7",
            {},
            "sample_alpha",
            size=1,
        )

        assert cache.tool_version == "0.23.4"

    async def test_concurrent_put_keeps_first(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
    ):
        first = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 50},
            "sample_alpha",
            size=1024,
        )

        second = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 50},
            "sample_alpha",
            size=9999,
        )

        assert first.id == second.id
        assert second.size == 1024

        async with AsyncSession(pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLCache).where(SQLCache.key == first.key),
                    )
                )
                .scalars()
                .all()
            )
        assert len(rows) == 1


class TestGet:
    async def test_missing_returns_none(self, caches: CachesData, static_time):
        assert await caches.get("missing") is None

    async def test_hit_returns_row(self, caches: CachesData, static_time):
        put = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
            size=1,
        )

        got = await caches.get(put.key)

        assert got is not None
        assert got.id == put.id

    async def test_does_not_touch_within_bucket(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
        mocker,
    ):
        put = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
            size=1,
        )

        bumped = static_time.datetime + (LAST_ACCESSED_BUCKET - timedelta(seconds=1))
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        await caches.get(put.key)

        row = await _read_row(pg, put.key)
        assert row.last_accessed_at == static_time.datetime

    async def test_touches_after_bucket(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
        mocker,
    ):
        put = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
            size=1,
        )

        bumped = static_time.datetime + LAST_ACCESSED_BUCKET + timedelta(seconds=1)
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        await caches.get(put.key)

        row = await _read_row(pg, put.key)
        assert row.last_accessed_at == bumped


class TestDelete:
    async def test_delete_by_key_hit(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
    ):
        put = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
            size=1,
        )

        deleted = await caches.delete_by_key(put.key)

        assert deleted is True
        assert await _read_row(pg, put.key) is None

    async def test_delete_by_key_miss(self, caches: CachesData, static_time):
        assert await caches.delete_by_key("missing") is False

    async def test_delete_for_parent_returns_keys(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
    ):
        owned_a = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 50},
            "sample_alpha",
            size=1,
        )
        owned_b = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 75},
            "sample_alpha",
            size=1,
        )
        other = await caches.put(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_beta",
            size=1,
        )

        deleted_keys = await caches.delete_for_parent("sample_alpha")

        assert set(deleted_keys) == {owned_a.key, owned_b.key}
        assert await _read_row(pg, owned_a.key) is None
        assert await _read_row(pg, owned_b.key) is None
        assert await _read_row(pg, other.key) is not None

    async def test_delete_for_parent_no_rows(self, caches: CachesData, static_time):
        assert await caches.delete_for_parent("nobody") == []
