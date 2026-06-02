import asyncio
from collections.abc import AsyncIterator
from hashlib import sha256
from pathlib import Path

import pytest
from pyfixtures import FixtureScope
from pytest_structlog import StructuredLogCapture

from virtool.data.layer import DataLayer
from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.cache import CacheHit, CacheMiss, WorkflowCache
from virtool.workflow.data.tar import write_path_as_tar


async def _read_file(path: Path) -> AsyncIterator[bytes]:
    with path.open("rb") as file:
        while chunk := await asyncio.to_thread(file.read, 1024 * 1024):
            yield chunk


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

        archive_path = tmp_path / "cache.tar"
        await write_path_as_tar(source, archive_path)
        await data_layer.caches.create(
            _read_file(archive_path), key, {"workflow": "nuvs"}
        )

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        target = tmp_path / "target"
        result = await workflow_cache.get(key, target)

        assert isinstance(result, CacheHit)
        assert result.key == key
        assert result.path == target / "artifact.bin"
        assert result.path.read_bytes() == payload
        assert log.has("cache hit", key=key)

    async def test_hit_uses_downloaded_archive(
        self,
        mocker,
        tmp_path: Path,
        work_path: Path,
    ):
        key = "workflow-cache-downloaded-archive"
        source = tmp_path / "artifact.bin"
        payload = b"cached payload"
        source.write_bytes(payload)

        cache_path = work_path / "caches"
        cache_path.mkdir()
        archive_path = cache_path / f"{sha256(key.encode()).hexdigest()}.tar"
        await write_path_as_tar(source, archive_path)

        api = mocker.Mock()
        api.get_cache = mocker.AsyncMock()
        workflow_cache = WorkflowCache(api, work_path)
        target = tmp_path / "target"
        result = await workflow_cache.get(key, target)

        assert isinstance(result, CacheHit)
        assert result.path == target / "artifact.bin"
        assert result.path.read_bytes() == payload
        api.get_cache.assert_not_awaited()

    async def test_miss(
        self,
        cache_scope: FixtureScope,
        log: StructuredLogCapture,
        tmp_path: Path,
    ):
        key = "workflow-cache-miss"

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        target = tmp_path / "target"
        result = await workflow_cache.get(key, target)

        assert isinstance(result, CacheMiss)
        assert result.key == key
        assert not target.exists()
        assert log.has("cache miss", key=key)

    async def test_non_empty_target_with_unrelated_file(
        self,
        cache_scope: FixtureScope,
        data_layer: DataLayer,
        tmp_path: Path,
    ):
        key = "workflow-cache-non-empty-target"
        source = tmp_path / "artifact.bin"
        source.write_bytes(b"cached payload")
        target = tmp_path / "target"
        target.mkdir()
        (target / "stale.txt").write_bytes(b"stale")

        archive_path = tmp_path / "cache.tar"
        await write_path_as_tar(source, archive_path)
        await data_layer.caches.create(
            _read_file(archive_path), key, {"workflow": "nuvs"}
        )

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        result = await workflow_cache.get(key, target)

        assert isinstance(result, CacheHit)
        assert result.path == target / "artifact.bin"
        assert result.path.read_bytes() == b"cached payload"
        assert (target / "stale.txt").read_bytes() == b"stale"

    async def test_file_occupied(
        self,
        cache_scope: FixtureScope,
        data_layer: DataLayer,
        tmp_path: Path,
    ):
        key = "workflow-cache-file-occupied"
        source = tmp_path / "artifact.bin"
        source.write_bytes(b"cached payload")
        target = tmp_path / "target"
        target.mkdir()
        (target / "artifact.bin").write_bytes(b"existing")

        archive_path = tmp_path / "cache.tar"
        await write_path_as_tar(source, archive_path)
        await data_layer.caches.create(
            _read_file(archive_path), key, {"workflow": "nuvs"}
        )

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")

        with pytest.raises(FileExistsError):
            await workflow_cache.get(key, target)

    async def test_directory_occupied(
        self,
        cache_scope: FixtureScope,
        tmp_path: Path,
    ):
        key = "workflow-cache-directory-occupied"
        source = tmp_path / "source"
        source.mkdir()
        (source / "reference.1.bt2").write_bytes(b"reference")
        target = tmp_path / "target"
        target.mkdir()
        (target / "source").mkdir()

        workflow_cache: WorkflowCache = await cache_scope.instantiate_by_key("cache")
        await workflow_cache.put(key, source)

        with pytest.raises(FileExistsError):
            await workflow_cache.get(key, target)


class TestWorkflowCachePut:
    async def test_file(
        self,
        cache_scope: FixtureScope,
        data_layer: DataLayer,
        tmp_path: Path,
        work_path: Path,
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
        assert not any((work_path / "caches").iterdir())

        hit = await data_layer.caches.get(key)
        expected_archive_path = tmp_path / "expected-cache.tar"
        await write_path_as_tar(source, expected_archive_path)
        target = tmp_path / "target"
        result = await workflow_cache.get(key, target)

        assert created is True
        assert hit.params == params
        assert hit.size == expected_archive_path.stat().st_size
        assert isinstance(result, CacheHit)
        assert result.path == target / "artifact.bin"
        assert result.path.read_bytes() == payload
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
        target = tmp_path / "target"
        result = await workflow_cache.get(key, target)

        assert created is True
        assert duplicate_created is False
        assert isinstance(result, CacheHit)
        assert result.path == target / "original.bin"
        assert result.path.read_bytes() == b"original"

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
        target = tmp_path / "target"
        result = await workflow_cache.get(key, target)

        assert created is True
        assert isinstance(result, CacheHit)
        assert result.path == target / "source"
        assert (result.path / "reference.1.bt2").read_bytes() == b"reference"
        assert (result.path / "nested" / "reference.2.bt2").read_bytes() == (
            b"nested-reference"
        )
