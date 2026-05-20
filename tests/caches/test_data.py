from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.caches.data import LAST_ACCESSED_REFRESH_INTERVAL, _storage_key
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.data.layer import DataLayer
from virtool.jobs.models import Workflow
from virtool.storage.protocol import StorageBackend
from virtool.workflow.models import WorkflowCacheParams


class CreateSampleCacheParams(WorkflowCacheParams):
    """Cache shape for the create_sample workflow, which uses skewer to trim reads.

    ``min_length`` is a skewer-specific knob carried through the workflow's
    cache key.
    """

    min_length: int = 0


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
    ):
        payload = b"trimmed-reads-payload"
        params = CreateSampleCacheParams(
            workflow_name=Workflow.CREATE_SAMPLE,
            workflow_version="0.2.2",
            step="trim_reads",
            min_length=50,
        )

        created = await data_layer.caches.create(
            _chunker(payload),
            params,
        )

        hit = await data_layer.caches.get(params)

        assert hit.id == created.id
        assert hit.key == created.key
        assert hit.params == {
            "workflow_name": "create_sample",
            "workflow_version": "0.2.2",
            "step": "trim_reads",
            "min_length": 50,
        }
        assert hit.size == created.size == len(payload)

        chunks = [chunk async for chunk in hit.data]
        assert b"".join(chunks) == payload

    async def test_duplicate_key_raises_already_exists(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
    ):
        first_payload = b"first-writer"
        params = CreateSampleCacheParams(
            workflow_name=Workflow.CREATE_SAMPLE,
            workflow_version="0.2.2",
            step="trim_reads",
            min_length=50,
        )

        await data_layer.caches.create(
            _chunker(first_payload),
            params,
        )

        with pytest.raises(CacheAlreadyExistsError):
            await data_layer.caches.create(
                _chunker(b"second-writer-different-bytes"),
                params,
            )

        hit = await data_layer.caches.get(params)
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

        params = CreateSampleCacheParams(
            workflow_name=Workflow.CREATE_SAMPLE,
            workflow_version="0.2.2",
            step="trim_reads",
        )

        with pytest.raises(RuntimeError, match="simulated commit failure"):
            await data_layer.caches.create(
                _chunker(b"orphan-payload"),
                params,
            )

        with pytest.raises(CacheMissError):
            await data_layer.caches.get(params)

        keys = [info.key async for info in memory_storage.list(_storage_key(""))]
        assert keys == []


class TestGet:
    async def test_missing_raises_cache_miss(self, data_layer: DataLayer):
        with pytest.raises(CacheMissError):
            await data_layer.caches.get(
                CreateSampleCacheParams(
                    workflow_name=Workflow.CREATE_SAMPLE,
                    workflow_version="0.2.2",
                    step="trim_reads",
                ),
            )

    async def test_touches_after_refresh_interval(
        self,
        data_layer: DataLayer,
        static_time,
        mocker,
    ):
        params = CreateSampleCacheParams(
            workflow_name=Workflow.CREATE_SAMPLE,
            workflow_version="0.2.2",
            step="trim_reads",
        )

        await data_layer.caches.create(
            _chunker(b"x"),
            params,
        )

        bumped = (
            static_time.datetime + LAST_ACCESSED_REFRESH_INTERVAL + timedelta(seconds=1)
        )
        mocker.patch("virtool.utils.timestamp", return_value=bumped)

        hit = await data_layer.caches.get(params)

        assert hit.last_accessed_at == bumped
