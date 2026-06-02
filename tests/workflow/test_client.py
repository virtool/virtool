import tarfile
from pathlib import Path

import pytest

from virtool.data.layer import DataLayer
from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.tar import write_path_as_tar
from virtool.workflow.errors import JobsAPINotFoundError


@pytest.fixture
async def cache_client(spawn_job_client) -> WorkflowAPIClient:
    client = await spawn_job_client(authenticated=True)

    return WorkflowAPIClient(
        client.session,
        f"http://{client.server.host}:{client.server.port}",
    )


class TestGetCache:
    async def test_ok(self, cache_client: WorkflowAPIClient, tmp_path: Path):
        payload = b"trimmed reads"
        source = tmp_path / "cache.blob"
        source.write_bytes(payload)

        await cache_client.put_cache(
            "trim-reads-blob",
            source,
            {"step": "trim_reads"},
        )
        dest = tmp_path / "downloaded-cache.blob"

        await cache_client.get_cache("trim-reads-blob", dest)

        assert dest.read_bytes() == payload

    async def test_not_found(self, cache_client: WorkflowAPIClient, tmp_path: Path):
        with pytest.raises(JobsAPINotFoundError):
            await cache_client.get_cache("missing-cache", tmp_path / "cache.blob")


class TestPutCache:
    async def test_file_ok(
        self,
        cache_client: WorkflowAPIClient,
        data_layer: DataLayer,
        tmp_path: Path,
    ):
        key = "caller-supplied-key"
        params = {"workflow": "create_sample", "details": {"min_length": 50}}
        payload = b"cached payload"
        source = tmp_path / "cache.blob"
        source.write_bytes(payload)
        dest = tmp_path / "downloaded-cache.blob"

        created = await cache_client.put_cache(key, source, params)
        hit = await data_layer.caches.get(key)
        await cache_client.get_cache(key, dest)

        assert created is True
        assert hit.key == key
        assert hit.params == params
        assert hit.size == len(payload)
        assert dest.read_bytes() == payload

    async def test_duplicate_returns_false_and_keeps_original_blob(
        self,
        cache_client: WorkflowAPIClient,
        tmp_path: Path,
    ):
        key = "duplicate-key"
        original_payload = b"original payload"
        original = tmp_path / "original.blob"
        original.write_bytes(original_payload)
        replacement = tmp_path / "replacement.blob"
        replacement.write_bytes(b"replacement payload")
        dest = tmp_path / "downloaded-cache.blob"

        created = await cache_client.put_cache(
            key,
            original,
            {"step": "trim_reads"},
        )
        duplicate_created = await cache_client.put_cache(
            key,
            replacement,
            {"step": "trim_reads", "attempt": 2},
        )
        await cache_client.get_cache(key, dest)

        assert created is True
        assert duplicate_created is False
        assert dest.read_bytes() == original_payload

    async def test_tar_file_feeds_put_cache(
        self,
        cache_client: WorkflowAPIClient,
        tmp_path: Path,
    ):
        directory = tmp_path / "bowtie2"
        nested = directory / "nested"
        nested.mkdir(parents=True)
        (directory / "reference.1.bt2").write_bytes(b"reference")
        (nested / "reference.2.bt2").write_bytes(b"nested-reference")
        dest = tmp_path / "cache.tar"
        source = tmp_path / "source.tar"
        await write_path_as_tar(directory, source)

        created = await cache_client.put_cache(
            "bowtie2-index",
            source,
            {"tool": "bowtie2", "version": "2.5.4"},
        )
        await cache_client.get_cache("bowtie2-index", dest)

        with tarfile.open(dest, mode="r:") as archive:
            assert sorted(archive.getnames()) == [
                "nested/reference.2.bt2",
                "reference.1.bt2",
            ]
            assert archive.extractfile("reference.1.bt2").read() == b"reference"
            assert archive.extractfile("nested/reference.2.bt2").read() == (
                b"nested-reference"
            )

        assert created is True
