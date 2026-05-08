from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.caches.data import LAST_ACCESSED_BUCKET, CachesData
from virtool.caches.pg import SQLCache
from virtool.caches.types import CacheType
from virtool.caches.utils import derive_key
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.filesystem import FilesystemProvider


@pytest.fixture
def storage(tmp_path: Path) -> FilesystemProvider:
    return FilesystemProvider(tmp_path / "storage")


@pytest.fixture
def caches(pg: AsyncEngine, storage: FilesystemProvider) -> CachesData:
    return CachesData(pg, storage)


async def _read_blob(storage: FilesystemProvider, key: str) -> bytes:
    chunks = []
    async for chunk in storage.read(f"caches/{key}"):
        chunks.append(chunk)
    return b"".join(chunks)


async def _blob_exists(storage: FilesystemProvider, key: str) -> bool:
    try:
        async for _ in storage.read(f"caches/{key}"):
            pass
    except StorageKeyNotFoundError:
        return False
    return True


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


async def _read_row(pg: AsyncEngine, key: str) -> SQLCache | None:
    async with AsyncSession(pg) as session:
        return (
            await session.execute(select(SQLCache).where(SQLCache.key == key))
        ).scalar_one_or_none()


class TestPut:
    async def test_inserts_row_and_writes_blob(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
        storage: FilesystemProvider,
    ):
        params = {
            "tool_name": "fastp",
            "tool_version": "0.23.4",
            "min_length": 50,
        }
        payload = b"trimmed-reads-payload"

        cache, inserted = await caches.put(
            _chunker(payload),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            params,
        )

        assert inserted is True
        assert cache.key == derive_key(
            CacheType.sample_trimmed_reads,
            params,
            "sample_alpha",
        )
        assert cache.size == len(payload)
        assert cache.params == params
        assert cache.created_at == static_time.datetime
        assert cache.last_accessed_at == static_time.datetime

        row = await _read_row(pg, cache.key)
        assert row is not None
        assert row.id == cache.id

        assert await _read_blob(storage, cache.key) == payload

    async def test_normalizes_stored_version(
        self,
        caches: CachesData,
        static_time,
    ):
        cache, _ = await caches.put(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "v0.23.4+build.7"},
        )

        assert cache.params["tool_version"] == "0.23.4"

    @pytest.mark.parametrize(
        "params",
        [
            {},
            {"tool_name": "fastp"},
            {"tool_version": "0.23.4"},
            {"min_length": 50},
        ],
    )
    async def test_rejects_missing_tool_keys(
        self,
        caches: CachesData,
        static_time,
        params: dict,
    ):
        with pytest.raises(ValueError, match="missing required keys"):
            await caches.put(
                _chunker(b"x"),
                CacheType.sample_trimmed_reads,
                "sample_alpha",
                params,
            )

    async def test_concurrent_put_keeps_first(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
    ):
        params = {
            "tool_name": "fastp",
            "tool_version": "0.23.4",
            "min_length": 50,
        }
        first_payload = b"first-writer"

        first, first_inserted = await caches.put(
            _chunker(first_payload),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            params,
        )

        second, second_inserted = await caches.put(
            _chunker(b"second-writer-different-bytes"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            params,
        )

        assert first_inserted is True
        assert second_inserted is False
        assert first.id == second.id
        assert second.size == len(first_payload)

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
        put, _ = await caches.put(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "0.23.4"},
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
        put, _ = await caches.put(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "0.23.4"},
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
        put, _ = await caches.put(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "0.23.4"},
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
        storage: FilesystemProvider,
    ):
        put, _ = await caches.put(
            _chunker(b"payload"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "0.23.4"},
        )
        assert await _blob_exists(storage, put.key)

        await caches.delete_by_key(put.key)

        assert await _read_row(pg, put.key) is None
        assert not await _blob_exists(storage, put.key)

    async def test_delete_by_key_miss_is_idempotent(
        self,
        caches: CachesData,
        static_time,
    ):
        await caches.delete_by_key("missing")

    async def test_delete_for_parent_filters_by_type(
        self,
        caches: CachesData,
        pg: AsyncEngine,
        static_time,
        storage: FilesystemProvider,
    ):
        owned_trimmed_a, _ = await caches.put(
            _chunker(b"a"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "0.23.4", "min_length": 50},
        )
        owned_trimmed_b, _ = await caches.put(
            _chunker(b"b"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            {"tool_name": "fastp", "tool_version": "0.23.4", "min_length": 75},
        )
        owned_other_type, _ = await caches.put(
            _chunker(b"c"),
            CacheType.subtraction_mapping_index,
            "sample_alpha",
            {"tool_name": "bowtie2", "tool_version": "2.5.1"},
        )
        other_parent, _ = await caches.put(
            _chunker(b"d"),
            CacheType.sample_trimmed_reads,
            "sample_beta",
            {"tool_name": "fastp", "tool_version": "0.23.4"},
        )

        deleted = await caches.delete_for_parent(
            "sample_alpha",
            CacheType.sample_trimmed_reads,
        )

        assert deleted == 2
        assert await _read_row(pg, owned_trimmed_a.key) is None
        assert await _read_row(pg, owned_trimmed_b.key) is None
        assert await _read_row(pg, owned_other_type.key) is not None
        assert await _read_row(pg, other_parent.key) is not None

        assert not await _blob_exists(storage, owned_trimmed_a.key)
        assert not await _blob_exists(storage, owned_trimmed_b.key)
        assert await _blob_exists(storage, owned_other_type.key)
        assert await _blob_exists(storage, other_parent.key)

    async def test_delete_for_parent_no_rows(self, caches: CachesData, static_time):
        assert (
            await caches.delete_for_parent(
                "nobody",
                CacheType.sample_trimmed_reads,
            )
            == 0
        )
