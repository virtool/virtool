import tarfile
from collections.abc import AsyncIterator
from io import BytesIO
from pathlib import Path

import pytest

from virtool.data.layer import DataLayer
from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.tar import get_tar_size, stream_dir_as_tar
from virtool.workflow.errors import JobsAPINotFoundError


async def _iter_chunks(*chunks: bytes) -> AsyncIterator[bytes]:
    for chunk in chunks:
        yield chunk


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
        await cache_client.put_cache(
            "trim-reads-blob",
            BytesIO(payload),
            len(payload),
            {"step": "trim_reads"},
        )
        dest = tmp_path / "cache.blob"

        await cache_client.get_cache("trim-reads-blob", dest)

        assert dest.read_bytes() == payload

    async def test_not_found(self, cache_client: WorkflowAPIClient, tmp_path: Path):
        with pytest.raises(JobsAPINotFoundError):
            await cache_client.get_cache("missing-cache", tmp_path / "cache.blob")


class TestPutCache:
    async def test_binary_fileobj_ok(
        self,
        cache_client: WorkflowAPIClient,
        data_layer: DataLayer,
        tmp_path: Path,
    ):
        key = "caller-supplied-key"
        params = {"workflow": "create_sample", "details": {"min_length": 50}}
        payload = b"cached payload"
        dest = tmp_path / "cache.blob"

        created = await cache_client.put_cache(
            key, BytesIO(payload), len(payload), params
        )
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
        dest = tmp_path / "cache.blob"

        created = await cache_client.put_cache(
            key,
            BytesIO(original_payload),
            len(original_payload),
            {"step": "trim_reads"},
        )
        duplicate_created = await cache_client.put_cache(
            key,
            BytesIO(b"replacement payload"),
            len(b"replacement payload"),
            {"step": "trim_reads", "attempt": 2},
        )
        await cache_client.get_cache(key, dest)

        assert created is True
        assert duplicate_created is False
        assert dest.read_bytes() == original_payload

    async def test_async_iterator_ok(
        self,
        cache_client: WorkflowAPIClient,
        tmp_path: Path,
    ):
        key = "async-iterator"
        dest = tmp_path / "cache.blob"

        created = await cache_client.put_cache(
            key,
            _iter_chunks(b"cached ", b"payload"),
            len(b"cached payload"),
            {"step": "trim_reads"},
        )
        await cache_client.get_cache(key, dest)

        assert created is True
        assert dest.read_bytes() == b"cached payload"

    async def test_tar_stream_feeds_put_cache(
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
        tar_size = await get_tar_size(directory)

        created = await cache_client.put_cache(
            "bowtie2-index",
            stream_dir_as_tar(directory),
            tar_size,
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
