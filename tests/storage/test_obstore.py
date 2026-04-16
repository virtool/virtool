import pytest
from obstore.store import MemoryStore

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.obstore import ObstoreProvider
from virtool.storage.types import StorageObjectInfo


@pytest.fixture
def provider():
    return ObstoreProvider(MemoryStore())


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _collect(aiter) -> list:
    return [item async for item in aiter]


class TestRead:
    async def test_ok(self, provider):
        await provider._store.put_async("samples/abc/reads.fq.gz", b"read data here")

        result = await _collect_bytes(provider.read("samples/abc/reads.fq.gz"))

        assert result == b"read data here"

    async def test_nonexistent_key(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("does/not/exist"))


class TestWrite:
    async def test_returns_byte_count(self, provider):
        data = b"x" * 5000

        size = await provider.write("uploads/file.txt", _async_iter(data))

        assert size == 5000

    async def test_creates_object(self, provider):
        data = b"hello"

        await provider.write("uploads/file.txt", _async_iter(data))

        result = await provider._store.get_async("uploads/file.txt")
        assert await result.bytes_async() == data

    async def test_overwrites_existing(self, provider):
        await provider.write("key", _async_iter(b"first"))
        await provider.write("key", _async_iter(b"second"))

        result = await provider._store.get_async("key")
        assert await result.bytes_async() == b"second"


class TestDelete:
    async def test_existing_key(self, provider):
        await provider._store.put_async("to_delete", b"data")

        await provider.delete("to_delete")

        with pytest.raises(FileNotFoundError):
            await provider._store.get_async("to_delete")

    async def test_nonexistent_is_idempotent(self, provider):
        await provider.delete("does/not/exist")


class TestList:
    async def test_with_prefix(self, provider):
        await provider._store.put_async("samples/a/reads.fq.gz", b"a")
        await provider._store.put_async("samples/b/reads.fq.gz", b"b")
        await provider._store.put_async("uploads/file.txt", b"c")

        result = await _collect(provider.list("samples/"))

        keys = sorted(item.key for item in result)
        assert keys == ["samples/a/reads.fq.gz", "samples/b/reads.fq.gz"]

    async def test_no_matches(self, provider):
        await provider._store.put_async("samples/a/reads.fq.gz", b"a")

        result = await _collect(provider.list("uploads/"))

        assert result == []

    async def test_metadata(self, provider):
        await provider._store.put_async("test/file.txt", b"hello")

        result = await _collect(provider.list("test/"))

        assert len(result) == 1

        info = result[0]
        assert isinstance(info, StorageObjectInfo)
        assert info.key == "test/file.txt"
        assert info.size == 5
        assert info.last_modified is not None
