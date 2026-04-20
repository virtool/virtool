import pytest

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.memory import MemoryStorageProvider
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo


@pytest.fixture
def provider():
    return MemoryStorageProvider()


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _collect(aiter) -> list:
    return [item async for item in aiter]


class TestRead:
    async def test_ok(self, provider):
        await provider.write("samples/abc/reads.fq.gz", _async_iter(b"read data here"))

        result = await _collect_bytes(provider.read("samples/abc/reads.fq.gz"))

        assert result == b"read data here"

    async def test_nonexistent_key(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("does/not/exist"))

    async def test_chunked_read(self, provider):
        data = b"x" * (STORAGE_CHUNK_SIZE + 1000)

        await provider.write("big/file.bin", _async_iter(data))

        chunks = [chunk async for chunk in provider.read("big/file.bin")]

        assert len(chunks) == 2
        assert b"".join(chunks) == data


class TestWrite:
    async def test_returns_byte_count(self, provider):
        data = b"x" * 5000

        size = await provider.write("uploads/file.txt", _async_iter(data))

        assert size == 5000

    async def test_creates_object(self, provider):
        data = b"hello"

        await provider.write("uploads/file.txt", _async_iter(data))

        assert provider.get_raw("uploads/file.txt") == data

    async def test_overwrites_existing(self, provider):
        await provider.write("key", _async_iter(b"first"))
        await provider.write("key", _async_iter(b"second"))

        assert provider.get_raw("key") == b"second"


class TestDelete:
    async def test_existing_key(self, provider):
        await provider.write("to_delete", _async_iter(b"data"))

        await provider.delete("to_delete")

        assert "to_delete" not in provider.keys()

    async def test_nonexistent_is_idempotent(self, provider):
        await provider.delete("does/not/exist")


class TestList:
    async def test_with_prefix(self, provider):
        await provider.write("samples/a/reads.fq.gz", _async_iter(b"a"))
        await provider.write("samples/b/reads.fq.gz", _async_iter(b"b"))
        await provider.write("uploads/file.txt", _async_iter(b"c"))

        result = await _collect(provider.list("samples/"))

        keys = sorted(item.key for item in result)
        assert keys == ["samples/a/reads.fq.gz", "samples/b/reads.fq.gz"]

    async def test_no_matches(self, provider):
        await provider.write("samples/a/reads.fq.gz", _async_iter(b"a"))

        result = await _collect(provider.list("uploads/"))

        assert result == []

    async def test_metadata(self, provider):
        await provider.write("test/file.txt", _async_iter(b"hello"))

        result = await _collect(provider.list("test/"))

        assert len(result) == 1

        info = result[0]
        assert isinstance(info, StorageObjectInfo)
        assert info.key == "test/file.txt"
        assert info.size == 5
        assert info.last_modified is not None


class TestHelpers:
    async def test_keys_empty(self, provider):
        assert provider.keys() == set()

    async def test_keys_after_writes(self, provider):
        await provider.write("a", _async_iter(b"1"))
        await provider.write("b/c", _async_iter(b"2"))

        assert provider.keys() == {"a", "b/c"}

    async def test_get_raw(self, provider):
        await provider.write("key", _async_iter(b"value"))

        assert provider.get_raw("key") == b"value"

    async def test_get_raw_missing_raises_key_error(self, provider):
        with pytest.raises(KeyError):
            provider.get_raw("missing")
