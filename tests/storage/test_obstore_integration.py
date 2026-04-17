"""Integration tests for :class:`ObstoreProvider` against real services.

Exercises the Protocol contract against Garage (S3-compatible) and Azurite
(Azure Blob emulator) containers defined in ``docker-compose.yml``. Each test
receives a fresh provider whose per-test prefix is purged before and after the
test, so runs are isolated across pytest-xdist workers.
"""

import pytest

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.obstore import ObstoreProvider
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo

pytestmark = pytest.mark.storage_integration


@pytest.fixture(params=["s3", "azure"])
def provider(request, s3_storage, azure_storage) -> ObstoreProvider:
    return {"s3": s3_storage, "azure": azure_storage}[request.param]


_SANITIZE = str.maketrans({"[": "_", "]": "_", "/": "_", " ": "_"})


def _key(request: pytest.FixtureRequest, worker_id: str, suffix: str) -> str:
    return f"test/{worker_id}/{request.node.name.translate(_SANITIZE)}/{suffix}"


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _collect(aiter) -> list:
    return [item async for item in aiter]


class TestRoundtrip:
    async def test_small(self, provider, request, worker_id):
        key = _key(request, worker_id, "small.txt")

        size = await provider.write(key, _async_iter(b"hello world"))

        assert size == len(b"hello world")
        assert await _collect_bytes(provider.read(key)) == b"hello world"

    async def test_large_streaming(self, provider, request, worker_id):
        key = _key(request, worker_id, "large.bin")
        payload = b"x" * (STORAGE_CHUNK_SIZE * 2 + 123)

        size = await provider.write(key, _async_iter(payload, chunk_size=512 * 1024))

        assert size == len(payload)
        assert await _collect_bytes(provider.read(key)) == payload

    async def test_overwrite(self, provider, request, worker_id):
        key = _key(request, worker_id, "overwrite.txt")

        await provider.write(key, _async_iter(b"first"))
        await provider.write(key, _async_iter(b"second"))

        assert await _collect_bytes(provider.read(key)) == b"second"


class TestDelete:
    async def test_existing(self, provider, request, worker_id):
        key = _key(request, worker_id, "to-delete.txt")

        await provider.write(key, _async_iter(b"data"))
        await provider.delete(key)

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read(key))

    async def test_nonexistent_is_idempotent(self, provider, request, worker_id):
        key = _key(request, worker_id, "never-existed.txt")

        await provider.delete(key)


class TestList:
    async def test_with_prefix(self, provider, request, worker_id):
        prefix = _key(request, worker_id, "")

        await provider.write(prefix + "a.txt", _async_iter(b"a"))
        await provider.write(prefix + "b.txt", _async_iter(b"b"))

        result = await _collect(provider.list(prefix))

        assert sorted(item.key for item in result) == [
            prefix + "a.txt",
            prefix + "b.txt",
        ]

    async def test_no_matches(self, provider, request, worker_id):
        prefix = _key(request, worker_id, "")

        result = await _collect(provider.list(prefix + "missing/"))

        assert result == []

    async def test_metadata(self, provider, request, worker_id):
        prefix = _key(request, worker_id, "")
        key = prefix + "metadata.txt"

        await provider.write(key, _async_iter(b"hello"))

        result = await _collect(provider.list(prefix))

        assert len(result) == 1

        info = result[0]
        assert isinstance(info, StorageObjectInfo)
        assert info.key == key
        assert info.size == 5
        assert info.last_modified is not None


class TestErrors:
    async def test_read_nonexistent_raises(self, provider, request, worker_id):
        key = _key(request, worker_id, "never-existed.txt")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read(key))
