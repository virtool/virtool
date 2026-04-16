import pytest

from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo


@pytest.fixture
def provider(tmp_path):
    return FilesystemProvider(tmp_path)


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _collect(aiter) -> list:
    return [item async for item in aiter]


class TestRead:
    async def test_ok(self, provider, tmp_path):
        path = tmp_path / "samples" / "abc" / "reads.fq.gz"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"read data here")

        result = await _collect_bytes(provider.read("samples/abc/reads.fq.gz"))

        assert result == b"read data here"

    async def test_nonexistent_key(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("does/not/exist"))

    async def test_chunked_read(self, provider, tmp_path):
        data = b"x" * (STORAGE_CHUNK_SIZE + 1000)

        path = tmp_path / "big" / "file.bin"
        path.parent.mkdir(parents=True)
        path.write_bytes(data)

        chunks = [chunk async for chunk in provider.read("big/file.bin")]

        assert len(chunks) == 2
        assert b"".join(chunks) == data


class TestWrite:
    async def test_returns_byte_count(self, provider):
        data = b"x" * 5000

        size = await provider.write("uploads/file.txt", _async_iter(data))

        assert size == 5000

    async def test_creates_object(self, provider, tmp_path):
        data = b"hello"

        await provider.write("uploads/file.txt", _async_iter(data))

        assert (tmp_path / "uploads" / "file.txt").read_bytes() == data

    async def test_overwrites_existing(self, provider, tmp_path):
        await provider.write("key", _async_iter(b"first"))
        await provider.write("key", _async_iter(b"second"))

        assert (tmp_path / "key").read_bytes() == b"second"

    async def test_creates_parent_directories(self, provider, tmp_path):
        await provider.write("deep/nested/path/file.txt", _async_iter(b"data"))

        assert (tmp_path / "deep" / "nested" / "path" / "file.txt").exists()

    async def test_atomic_no_partial_on_error(self, provider, tmp_path):
        async def _failing_iter():
            yield b"partial"
            raise RuntimeError("mid-stream failure")

        with pytest.raises(RuntimeError, match="mid-stream failure"):
            await provider.write("target.txt", _failing_iter())

        assert not (tmp_path / "target.txt").exists()


class TestDelete:
    async def test_existing_key(self, provider, tmp_path):
        path = tmp_path / "to_delete"
        path.write_bytes(b"data")

        await provider.delete("to_delete")

        assert not path.exists()

    async def test_nonexistent_is_idempotent(self, provider):
        await provider.delete("does/not/exist")

    async def test_cleans_empty_parents(self, provider, tmp_path):
        path = tmp_path / "a" / "b" / "c" / "file.txt"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"data")

        await provider.delete("a/b/c/file.txt")

        assert not (tmp_path / "a").exists()

    async def test_preserves_non_empty_parents(self, provider, tmp_path):
        (tmp_path / "a" / "b").mkdir(parents=True)
        (tmp_path / "a" / "b" / "keep.txt").write_bytes(b"keep")
        (tmp_path / "a" / "b" / "remove.txt").write_bytes(b"remove")

        await provider.delete("a/b/remove.txt")

        assert (tmp_path / "a" / "b" / "keep.txt").exists()


class TestList:
    async def test_with_prefix(self, provider, tmp_path):
        (tmp_path / "samples" / "a").mkdir(parents=True)
        (tmp_path / "samples" / "b").mkdir(parents=True)
        (tmp_path / "uploads").mkdir(parents=True)

        (tmp_path / "samples" / "a" / "reads.fq.gz").write_bytes(b"a")
        (tmp_path / "samples" / "b" / "reads.fq.gz").write_bytes(b"b")
        (tmp_path / "uploads" / "file.txt").write_bytes(b"c")

        result = await _collect(provider.list("samples/"))

        keys = sorted(item.key for item in result)
        assert keys == ["samples/a/reads.fq.gz", "samples/b/reads.fq.gz"]

    async def test_no_matches(self, provider, tmp_path):
        (tmp_path / "samples" / "a").mkdir(parents=True)
        (tmp_path / "samples" / "a" / "reads.fq.gz").write_bytes(b"a")

        result = await _collect(provider.list("uploads/"))

        assert result == []

    async def test_metadata(self, provider, tmp_path):
        (tmp_path / "test").mkdir()
        (tmp_path / "test" / "file.txt").write_bytes(b"hello")

        result = await _collect(provider.list("test/"))

        assert len(result) == 1

        info = result[0]
        assert isinstance(info, StorageObjectInfo)
        assert info.key == "test/file.txt"
        assert info.size == 5
        assert info.last_modified is not None

    async def test_empty_directory(self, provider):
        result = await _collect(provider.list("nonexistent/"))

        assert result == []


class TestSecurity:
    async def test_path_traversal_rejected(self, provider):
        with pytest.raises(StorageError):
            await _collect_bytes(provider.read("../../etc/passwd"))

    async def test_path_traversal_rejected_on_write(self, provider):
        with pytest.raises(StorageError):
            await provider.write("../../etc/evil", _async_iter(b"bad"))

    async def test_path_traversal_rejected_on_delete(self, provider):
        with pytest.raises(StorageError):
            await provider.delete("../../etc/passwd")
