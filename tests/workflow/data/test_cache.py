from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from pyfixtures import FixtureScope
from pytest_structlog import StructuredLogCapture

from virtool.data.layer import DataLayer
from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.cache import CacheHit, CacheMiss, WorkflowCache
from virtool.workflow.data.tar import get_tar_size, stream_path_as_tar


@pytest.fixture
async def cache_scope(spawn_job_client, work_path: Path) -> AsyncIterator[FixtureScope]:
    client = await spawn_job_client(authenticated=True)

    async with FixtureScope() as scope:
        scope["_api"] = WorkflowAPIClient(
            client.session,
            f"http://{client.server.host}:{client.server.port}",
        )
        scope["work_path"] = work_path

        yield scope


class TestWorkflowCacheGet:
    async def test_hit(
        self,
        cache_scope: FixtureScope,
        data_layer: DataLayer,
        log: StructuredLogCapture,
        tmp_path: Path,
    ):
        key = "workflow-cache-hit"
        source = tmp_path / "artifact.bin"
        payload = b"cached payload"
        source.write_bytes(payload)

        await data_layer.caches.create(
            stream_path_as_tar(source),
            key,
            {"workflow": "nuvs"},
        )

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        result = await workflow_cache.get(key)

        assert isinstance(result, CacheHit)
        assert result.key == key
        assert (result.path / "artifact.bin").read_bytes() == payload
        assert log.has("cache hit", key=key)

    async def test_miss(
        self,
        cache_scope: FixtureScope,
        log: StructuredLogCapture,
    ):
        key = "workflow-cache-miss"

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        result = await workflow_cache.get(key)

        assert isinstance(result, CacheMiss)
        assert result.key == key
        assert log.has("cache miss", key=key)


class TestWorkflowCachePut:
    async def test_file(
        self,
        cache_scope: FixtureScope,
        data_layer: DataLayer,
        tmp_path: Path,
        log: StructuredLogCapture,
    ):
        key = "workflow-cache-file"
        source = tmp_path / "artifact.bin"
        payload = b"cached file"
        params = {
            "workflow": "nuvs",
            "details": {"min_length": 50, "custom": ["value"]},
        }
        source.write_bytes(payload)

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        created = await workflow_cache.put(key, source, params=params)
        hit = await data_layer.caches.get(key)
        result = await workflow_cache.get(key)

        assert created is True
        assert hit.params == params
        assert hit.size == await get_tar_size(source)
        assert isinstance(result, CacheHit)
        assert (result.path / "artifact.bin").read_bytes() == payload
        assert log.has("cache put", key=key, created=True)

    async def test_duplicate(
        self,
        cache_scope: FixtureScope,
        tmp_path: Path,
    ):
        key = "workflow-cache-duplicate"
        original = tmp_path / "original.bin"
        replacement = tmp_path / "replacement.bin"
        original.write_bytes(b"original")
        replacement.write_bytes(b"replacement")

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        created = await workflow_cache.put(key, original)
        duplicate_created = await workflow_cache.put(key, replacement)
        result = await workflow_cache.get(key)

        assert created is True
        assert duplicate_created is False
        assert isinstance(result, CacheHit)
        assert (result.path / "original.bin").read_bytes() == b"original"

    async def test_directory_tar_round_trip(
        self,
        cache_scope: FixtureScope,
        tmp_path: Path,
    ):
        key = "workflow-cache-directory"
        source = tmp_path / "source"
        nested = source / "nested"
        nested.mkdir(parents=True)
        (source / "reference.1.bt2").write_bytes(b"reference")
        (nested / "reference.2.bt2").write_bytes(b"nested-reference")

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        created = await workflow_cache.put(
            key,
            source,
            params={"tool": "bowtie2", "version": "2.5.4"},
        )
        result = await workflow_cache.get(key)

        assert created is True
        assert isinstance(result, CacheHit)
        assert (result.path / "reference.1.bt2").read_bytes() == b"reference"
        assert (result.path / "nested" / "reference.2.bt2").read_bytes() == (
            b"nested-reference"
        )
