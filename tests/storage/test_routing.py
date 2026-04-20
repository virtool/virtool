import pytest

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.memory import MemoryStorageProvider
from virtool.storage.routing import FallbackStorageRouter


@pytest.fixture
def primary():
    return MemoryStorageProvider()


@pytest.fixture
def fallback():
    return MemoryStorageProvider()


@pytest.fixture
def router(primary, fallback):
    return FallbackStorageRouter(primary, fallback)


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _collect(aiter) -> list:
    return [item async for item in aiter]


class TestRead:
    async def test_reads_from_primary(self, primary, router):
        await primary.write("key", _async_iter(b"primary data"))

        result = await _collect_bytes(router.read("key"))

        assert result == b"primary data"

    async def test_falls_back_to_fallback(self, fallback, router):
        await fallback.write("key", _async_iter(b"fallback data"))

        result = await _collect_bytes(router.read("key"))

        assert result == b"fallback data"

    async def test_primary_takes_precedence(self, primary, fallback, router):
        await primary.write("key", _async_iter(b"primary"))
        await fallback.write("key", _async_iter(b"fallback"))

        result = await _collect_bytes(router.read("key"))

        assert result == b"primary"

    async def test_missing_from_both_raises(self, router):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(router.read("missing"))


class TestWrite:
    async def test_writes_to_primary_only(self, primary, fallback, router):
        await router.write("key", _async_iter(b"data"))

        assert "key" in primary.keys()
        assert "key" not in fallback.keys()

    async def test_returns_byte_count(self, router):
        size = await router.write("key", _async_iter(b"hello"))

        assert size == 5


class TestDelete:
    async def test_deletes_from_both(self, primary, fallback, router):
        await primary.write("key", _async_iter(b"a"))
        await fallback.write("key", _async_iter(b"b"))

        await router.delete("key")

        assert "key" not in primary.keys()
        assert "key" not in fallback.keys()

    async def test_primary_only(self, primary, fallback, router):
        await primary.write("key", _async_iter(b"a"))

        await router.delete("key")

        assert "key" not in primary.keys()

    async def test_fallback_only(self, fallback, router):
        await fallback.write("key", _async_iter(b"a"))

        await router.delete("key")

        assert "key" not in fallback.keys()

    async def test_missing_from_both(self, router):
        await router.delete("missing")


class TestList:
    async def test_merges_results(self, primary, fallback, router):
        await primary.write("a/1", _async_iter(b"p"))
        await fallback.write("a/2", _async_iter(b"f"))

        result = await _collect(router.list("a/"))

        keys = sorted(info.key for info in result)
        assert keys == ["a/1", "a/2"]

    async def test_deduplicates_by_key(self, primary, fallback, router):
        await primary.write("a/1", _async_iter(b"short"))
        await fallback.write("a/1", _async_iter(b"longer value"))

        result = await _collect(router.list("a/"))

        assert len(result) == 1
        assert result[0].key == "a/1"
        assert result[0].size == 5

    async def test_primary_only(self, primary, router):
        await primary.write("a/1", _async_iter(b"p"))

        result = await _collect(router.list("a/"))

        assert len(result) == 1
        assert result[0].key == "a/1"

    async def test_fallback_only(self, fallback, router):
        await fallback.write("a/1", _async_iter(b"f"))

        result = await _collect(router.list("a/"))

        assert len(result) == 1
        assert result[0].key == "a/1"

    async def test_empty(self, router):
        result = await _collect(router.list("a/"))

        assert result == []

    async def test_prefix_filtering(self, primary, fallback, router):
        await primary.write("a/1", _async_iter(b"p"))
        await fallback.write("b/1", _async_iter(b"f"))

        result = await _collect(router.list("a/"))

        assert len(result) == 1
        assert result[0].key == "a/1"


class TestSameInstance:
    @pytest.fixture
    def backend(self):
        return MemoryStorageProvider()

    @pytest.fixture
    def router(self, backend):
        return FallbackStorageRouter(backend, backend)

    async def test_read(self, backend, router):
        await backend.write("key", _async_iter(b"data"))

        result = await _collect_bytes(router.read("key"))

        assert result == b"data"

    async def test_write(self, backend, router):
        await router.write("key", _async_iter(b"data"))

        assert backend.get_raw("key") == b"data"

    async def test_delete(self, backend, router):
        await backend.write("key", _async_iter(b"data"))

        await router.delete("key")

        assert "key" not in backend.keys()

    async def test_list_no_duplicates(self, backend, router):
        await backend.write("a/1", _async_iter(b"x"))
        await backend.write("a/2", _async_iter(b"y"))

        result = await _collect(router.list("a/"))

        keys = sorted(info.key for info in result)
        assert keys == ["a/1", "a/2"]
