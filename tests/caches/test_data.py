from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.caches.data import LAST_ACCESSED_BUCKET, _blob_key
from virtool.caches.pg import SQLCache
from virtool.caches.types import CacheType
from virtool.caches.utils import derive_key
from virtool.data.errors import CacheAlreadyExistsError
from virtool.data.layer import DataLayer
from virtool.pg.utils import get_row
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


class TestBlobKey:
    def test_pins_v1_namespace(self):
        assert (
            _blob_key("3d8f1c527a4e4b9c9a521c8e7d3b0a91")
            == "caches/v1/3d8f1c527a4e4b9c9a521c8e7d3b0a91"
        )


class TestPut:
    async def test_inserts_row_and_writes_blob(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        memory_storage: StorageBackend,
    ):
        payload = b"trimmed-reads-payload"

        cache = await data_layer.caches.create(
            _chunker(payload),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 50},
        )

        assert cache.key == derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 50},
        )
        assert cache.blob_uuid
        assert cache.size == len(payload)
        assert cache.params == {
            "tool_name": "skewer",
            "tool_version": "0.2.2",
            "min_length": 50,
        }
        assert cache.created_at == static_time.datetime
        assert cache.last_accessed_at == static_time.datetime

        row = await get_row(pg, SQLCache, ("key", cache.key))
        assert row is not None
        assert row.id == cache.id
        assert row.blob_uuid == cache.blob_uuid

        chunks = [
            chunk async for chunk in memory_storage.read(_blob_key(cache.blob_uuid))
        ]
        assert b"".join(chunks) == payload

    async def test_normalizes_stored_version(
        self,
        data_layer: DataLayer,
        static_time,
    ):
        cache = await data_layer.caches.create(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "v0.2.2+build.7",
            {},
        )

        assert cache.params["tool_version"] == "0.2.2"

    async def test_duplicate_key_raises_already_exists(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        memory_storage: StorageBackend,
    ):
        first_payload = b"first-writer"

        first = await data_layer.caches.create(
            _chunker(first_payload),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 50},
        )

        with pytest.raises(CacheAlreadyExistsError):
            await data_layer.caches.create(
                _chunker(b"second-writer-different-bytes"),
                CacheType.sample_trimmed_reads,
                "sample_alpha",
                "skewer",
                "0.2.2",
                {"min_length": 50},
            )

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
        assert rows[0].blob_uuid == first.blob_uuid

        keys = [info.key async for info in memory_storage.list(_blob_key(""))]
        assert keys == [_blob_key(first.blob_uuid)]

        chunks = [
            chunk async for chunk in memory_storage.read(_blob_key(first.blob_uuid))
        ]
        assert b"".join(chunks) == first_payload

    async def test_db_failure_deletes_blob_and_propagates(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
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
                CacheType.sample_trimmed_reads,
                "sample_alpha",
                "skewer",
                "0.2.2",
                {},
            )

        keys = [info.key async for info in memory_storage.list(_blob_key(""))]
        assert keys == []


class TestGet:
    async def test_missing_returns_none(self, data_layer: DataLayer, static_time):
        assert (
            await data_layer.caches.get(
                CacheType.sample_trimmed_reads,
                "sample_alpha",
                "skewer",
                "0.2.2",
                {},
            )
            is None
        )

    async def test_hit_returns_row(self, data_layer: DataLayer, static_time):
        cache = await data_layer.caches.create(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        got = await data_layer.caches.get(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        assert got is not None
        assert got.id == cache.id

    async def test_does_not_touch_within_bucket(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        mocker,
    ):
        cache = await data_layer.caches.create(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        bumped = static_time.datetime + (LAST_ACCESSED_BUCKET - timedelta(seconds=1))
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        await data_layer.caches.get(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        row = await get_row(pg, SQLCache, ("key", cache.key))
        assert row.last_accessed_at == static_time.datetime

    async def test_touches_after_bucket(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        mocker,
    ):
        cache = await data_layer.caches.create(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        bumped = static_time.datetime + LAST_ACCESSED_BUCKET + timedelta(seconds=1)
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        await data_layer.caches.get(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        row = await get_row(pg, SQLCache, ("key", cache.key))
        assert row.last_accessed_at == bumped


class TestDelete:
    async def test_delete_by_key_hit(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        memory_storage: StorageBackend,
    ):
        cache = await data_layer.caches.create(
            _chunker(b"payload"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )
        keys_before = [
            info.key async for info in memory_storage.list(_blob_key(cache.blob_uuid))
        ]
        assert keys_before == [_blob_key(cache.blob_uuid)]

        await data_layer.caches.delete_by_key(cache.key)

        assert await get_row(pg, SQLCache, ("key", cache.key)) is None
        keys_after = [
            info.key async for info in memory_storage.list(_blob_key(cache.blob_uuid))
        ]
        assert keys_after == []

    async def test_delete_by_key_is_idempotent(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        memory_storage: StorageBackend,
    ):
        cache = await data_layer.caches.create(
            _chunker(b"payload"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        await data_layer.caches.delete_by_key(cache.key)
        await data_layer.caches.delete_by_key(cache.key)

        assert await get_row(pg, SQLCache, ("key", cache.key)) is None
        keys = [info.key async for info in memory_storage.list(_blob_key(""))]
        assert keys == []

        await data_layer.caches.delete_by_key("never-existed")

    async def test_delete_by_parent_filters_by_type(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time,
        memory_storage: StorageBackend,
    ):
        owned_trimmed_a = await data_layer.caches.create(
            _chunker(b"a"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 50},
        )
        owned_trimmed_b = await data_layer.caches.create(
            _chunker(b"b"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 75},
        )
        owned_other_type = await data_layer.caches.create(
            _chunker(b"c"),
            CacheType.subtraction_mapping_index,
            "sample_alpha",
            "bowtie2",
            "2.5.1",
            {},
        )
        other_parent = await data_layer.caches.create(
            _chunker(b"d"),
            CacheType.sample_trimmed_reads,
            "sample_beta",
            "skewer",
            "0.2.2",
            {},
        )

        deleted = await data_layer.caches.delete_by_parent(
            "sample_alpha",
            CacheType.sample_trimmed_reads,
        )

        assert deleted == 2
        assert await get_row(pg, SQLCache, ("key", owned_trimmed_a.key)) is None
        assert await get_row(pg, SQLCache, ("key", owned_trimmed_b.key)) is None
        assert await get_row(pg, SQLCache, ("key", owned_other_type.key)) is not None
        assert await get_row(pg, SQLCache, ("key", other_parent.key)) is not None

        remaining = sorted(
            [info.key async for info in memory_storage.list(_blob_key(""))],
        )
        assert remaining == sorted(
            [
                _blob_key(owned_other_type.blob_uuid),
                _blob_key(other_parent.blob_uuid),
            ],
        )

    async def test_delete_by_parent_no_rows(
        self,
        data_layer: DataLayer,
        static_time,
    ):
        assert (
            await data_layer.caches.delete_by_parent(
                "nobody",
                CacheType.sample_trimmed_reads,
            )
            == 0
        )
