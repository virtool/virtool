from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.caches.data import LAST_ACCESSED_BUCKET, _storage_key
from virtool.caches.types import CacheType
from virtool.data.errors import CacheAlreadyExistsError
from virtool.data.layer import DataLayer
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


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
        static_time,
    ):
        payload = b"trimmed-reads-payload"
        cache_type = CacheType.sample_trimmed_reads
        parent_id = "sample_alpha"
        tool_name = "skewer"
        tool_version = "0.2.2"
        params = {"min_length": 50}

        created = await data_layer.caches.create(
            _chunker(payload),
            cache_type,
            parent_id,
            tool_name,
            tool_version,
            params,
        )

        hit = await data_layer.caches.get(
            cache_type,
            parent_id,
            tool_name,
            tool_version,
            params,
        )

        assert hit is not None
        assert hit.id == created.id
        assert hit.key == created.key
        assert hit.storage_key == created.storage_key
        assert hit.type == cache_type
        assert hit.parent_id == parent_id
        assert hit.params == {
            "tool_name": tool_name,
            "tool_version": tool_version,
            "min_length": 50,
        }
        assert hit.size == created.size == len(payload)

        chunks = [chunk async for chunk in hit.data]
        assert b"".join(chunks) == payload

    async def test_duplicate_key_raises_already_exists(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        static_time,
    ):
        first_payload = b"first-writer"
        cache_type = CacheType.sample_trimmed_reads
        parent_id = "sample_alpha"
        tool_name = "skewer"
        tool_version = "0.2.2"
        params = {"min_length": 50}

        await data_layer.caches.create(
            _chunker(first_payload),
            cache_type,
            parent_id,
            tool_name,
            tool_version,
            params,
        )

        with pytest.raises(CacheAlreadyExistsError):
            await data_layer.caches.create(
                _chunker(b"second-writer-different-bytes"),
                cache_type,
                parent_id,
                tool_name,
                tool_version,
                params,
            )

        hit = await data_layer.caches.get(
            cache_type,
            parent_id,
            tool_name,
            tool_version,
            params,
        )
        assert hit is not None
        chunks = [chunk async for chunk in hit.data]
        assert b"".join(chunks) == first_payload

        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert len(keys) == 1

    async def test_db_failure_deletes_storage_object_and_propagates(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        static_time,
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

        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
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

    async def test_does_not_touch_within_bucket(
        self,
        data_layer: DataLayer,
        static_time,
        mocker,
    ):
        await data_layer.caches.create(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        bumped = static_time.datetime + (LAST_ACCESSED_BUCKET - timedelta(seconds=1))
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        hit = await data_layer.caches.get(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        assert hit is not None
        assert hit.last_accessed_at == static_time.datetime

    async def test_touches_after_bucket(
        self,
        data_layer: DataLayer,
        static_time,
        mocker,
    ):
        await data_layer.caches.create(
            _chunker(b"x"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        bumped = static_time.datetime + LAST_ACCESSED_BUCKET + timedelta(seconds=1)
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        hit = await data_layer.caches.get(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {},
        )

        assert hit is not None
        assert hit.last_accessed_at == bumped


class TestDelete:
    async def test_delete_by_key_hit(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        static_time,
    ):
        cache_type = CacheType.sample_trimmed_reads
        parent_id = "sample_alpha"
        tool_name = "skewer"
        tool_version = "0.2.2"
        params = {}

        created = await data_layer.caches.create(
            _chunker(b"payload"),
            cache_type,
            parent_id,
            tool_name,
            tool_version,
            params,
        )

        await data_layer.caches.delete_by_key(created.key)

        assert (
            await data_layer.caches.get(
                cache_type,
                parent_id,
                tool_name,
                tool_version,
                params,
            )
            is None
        )
        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert keys == []

    async def test_delete_by_key_is_idempotent(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        static_time,
    ):
        cache_type = CacheType.sample_trimmed_reads
        parent_id = "sample_alpha"
        tool_name = "skewer"
        tool_version = "0.2.2"
        params = {}

        created = await data_layer.caches.create(
            _chunker(b"payload"),
            cache_type,
            parent_id,
            tool_name,
            tool_version,
            params,
        )

        await data_layer.caches.delete_by_key(created.key)
        await data_layer.caches.delete_by_key(created.key)
        await data_layer.caches.delete_by_key("never-existed")

        assert (
            await data_layer.caches.get(
                cache_type,
                parent_id,
                tool_name,
                tool_version,
                params,
            )
            is None
        )
        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert keys == []

    async def test_delete_by_parent_filters_by_type(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        static_time,
    ):
        await data_layer.caches.create(
            _chunker(b"a"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 50},
        )
        await data_layer.caches.create(
            _chunker(b"b"),
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "skewer",
            "0.2.2",
            {"min_length": 75},
        )
        await data_layer.caches.create(
            _chunker(b"c"),
            CacheType.subtraction_mapping_index,
            "sample_alpha",
            "bowtie2",
            "2.5.1",
            {},
        )
        await data_layer.caches.create(
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

        # Targeted rows are gone.
        assert (
            await data_layer.caches.get(
                CacheType.sample_trimmed_reads,
                "sample_alpha",
                "skewer",
                "0.2.2",
                {"min_length": 50},
            )
            is None
        )
        assert (
            await data_layer.caches.get(
                CacheType.sample_trimmed_reads,
                "sample_alpha",
                "skewer",
                "0.2.2",
                {"min_length": 75},
            )
            is None
        )

        # Other type for the same parent survives.
        assert (
            await data_layer.caches.get(
                CacheType.subtraction_mapping_index,
                "sample_alpha",
                "bowtie2",
                "2.5.1",
                {},
            )
            is not None
        )

        # Same type for a different parent survives.
        assert (
            await data_layer.caches.get(
                CacheType.sample_trimmed_reads,
                "sample_beta",
                "skewer",
                "0.2.2",
                {},
            )
            is not None
        )

        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert len(keys) == 2

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
