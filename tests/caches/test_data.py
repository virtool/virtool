from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.caches.data import LAST_ACCESSED_REFRESH_INTERVAL, _storage_key
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.data.layer import DataLayer
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


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

        cache = await data_layer.caches.get(TRIM_READS_KEY)

        assert cache.id == created.id
        assert cache.key == created.key == TRIM_READS_KEY
        assert cache.params == created.params == TRIM_READS_PARAMS
        assert cache.size == created.size == len(payload)

        hit = await data_layer.caches.get_blob(TRIM_READS_KEY)
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

        hit = await data_layer.caches.get_blob(TRIM_READS_KEY)
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
