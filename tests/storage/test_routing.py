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

    async def test_primary_error_does_not_fall_back(
        self, primary, fallback, router, mocker
    ):
        """A non-missing primary failure must propagate, not serve the fallback.

        Otherwise a misconfigured or unreachable primary (e.g. a permissions
        error that the backend happens to surface as ``FileNotFoundError``)
        would silently serve a stale fallback copy instead of failing loudly.
        """
        await fallback.write("key", _async_iter(b"stale"))

        mocker.patch.object(primary, "size", side_effect=RuntimeError("primary down"))

        with pytest.raises(RuntimeError, match="primary down"):
            await _collect_bytes(router.read("key"))


class TestWrite:
    async def test_writes_to_primary_only(self, primary, fallback, router):
        await router.write("key", _async_iter(b"data"))

        assert await _collect_bytes(primary.read("key")) == b"data"

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(fallback.read("key"))

    async def test_returns_byte_count(self, router):
        size = await router.write("key", _async_iter(b"hello"))

        assert size == 5

    async def test_drains_fallback_on_successful_write(self, primary, fallback, router):
        """A successful write removes any pre-existing legacy copy in the fallback.

        This keeps the migration shim draining over time so the fallback is
        never left holding shadow copies of keys the primary now owns.
        """
        await fallback.write("key", _async_iter(b"legacy"))

        await router.write("key", _async_iter(b"new"))

        assert await _collect_bytes(primary.read("key")) == b"new"
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(fallback.read("key"))

        assert await _collect_bytes(router.read("key")) == b"new"

    async def test_drains_fallback_even_if_primary_write_fails(
        self, primary, fallback, router, mocker
    ):
        """A failed primary write must not leave the stale fallback copy readable.

        Without the pre-write drain, the next read would silently serve the
        legacy copy as if it were the new write. After the drain, the read
        raises ``StorageKeyNotFoundError`` so callers see the failure.
        """
        await fallback.write("key", _async_iter(b"legacy"))

        mocker.patch.object(primary, "write", side_effect=RuntimeError("primary down"))

        with pytest.raises(RuntimeError, match="primary down"):
            await router.write("key", _async_iter(b"new"))

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(router.read("key"))

    async def test_fallback_delete_failure_aborts_write(
        self, primary, fallback, router, mocker
    ):
        """A failed fallback drain must abort before touching the primary.

        Otherwise a successful primary write would leave the legacy copy in
        place silently. Failing fast keeps state unchanged so the caller can
        retry safely.
        """
        await fallback.write("key", _async_iter(b"legacy"))

        primary_write = mocker.spy(primary, "write")
        mocker.patch.object(
            fallback,
            "delete",
            side_effect=RuntimeError("fallback delete down"),
        )

        with pytest.raises(RuntimeError, match="fallback delete down"):
            await router.write("key", _async_iter(b"new"))

        primary_write.assert_not_called()


class TestCopy:
    async def test_copies_within_primary(self, primary, router):
        await primary.write("src", _async_iter(b"data"))

        await router.copy("src", "dst")

        assert await _collect_bytes(primary.read("dst")) == b"data"

    async def test_uses_primary_copy_when_source_is_on_primary(
        self, primary, fallback, router, mocker
    ):
        """A primary-resident source must be copied server-side, not streamed.

        Falling back to read-then-write would pull the object through this
        process, which for a multi-gigabyte reads file is the difference
        between a metadata-scale operation and a full transfer.
        """
        await primary.write("src", _async_iter(b"data"))

        primary_copy = mocker.spy(primary, "copy")
        primary_write = mocker.spy(primary, "write")

        await router.copy("src", "dst")

        primary_copy.assert_called_once_with("src", "dst")
        primary_write.assert_not_called()

    async def test_promotes_source_from_fallback(self, primary, fallback, router):
        await fallback.write("src", _async_iter(b"legacy"))

        await router.copy("src", "dst")

        assert await _collect_bytes(primary.read("dst")) == b"legacy"

    async def test_leaves_fallback_source_in_place(self, fallback, router):
        await fallback.write("src", _async_iter(b"legacy"))

        await router.copy("src", "dst")

        assert await _collect_bytes(fallback.read("src")) == b"legacy"

    async def test_drains_stale_fallback_destination(self, primary, fallback, router):
        """A stale fallback object at ``dst`` must never outlive the copy.

        Reads probe the primary first, so a surviving fallback copy would only
        surface if the primary object were later lost -- serving stale bytes
        under a key the migration believes it rewrote.
        """
        await primary.write("src", _async_iter(b"new"))
        await fallback.write("dst", _async_iter(b"stale"))

        await router.copy("src", "dst")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(fallback.read("dst"))

        assert await _collect_bytes(router.read("dst")) == b"new"

    async def test_nonexistent_source(self, router):
        with pytest.raises(StorageKeyNotFoundError):
            await router.copy("does/not/exist", "dst")


class TestDelete:
    async def test_deletes_from_both(self, primary, fallback, router):
        await primary.write("key", _async_iter(b"a"))
        await fallback.write("key", _async_iter(b"b"))

        await router.delete("key")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(primary.read("key"))

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(fallback.read("key"))

    async def test_primary_only(self, primary, fallback, router):
        await primary.write("key", _async_iter(b"a"))

        await router.delete("key")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(primary.read("key"))

    async def test_fallback_only(self, fallback, router):
        await fallback.write("key", _async_iter(b"a"))

        await router.delete("key")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(fallback.read("key"))

    async def test_missing_from_both(self, router):
        await router.delete("missing")

    async def test_fallback_failure_does_not_skip_primary(
        self, primary, fallback, router, mocker
    ):
        await primary.write("key", _async_iter(b"a"))

        boom = RuntimeError("fallback down")
        mocker.patch.object(fallback, "delete", side_effect=boom)

        with pytest.raises(RuntimeError, match="fallback down"):
            await router.delete("key")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(primary.read("key"))

    async def test_primary_failure_does_not_skip_fallback(
        self, primary, fallback, router, mocker
    ):
        await fallback.write("key", _async_iter(b"a"))

        boom = RuntimeError("primary down")
        mocker.patch.object(primary, "delete", side_effect=boom)

        with pytest.raises(RuntimeError, match="primary down"):
            await router.delete("key")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(fallback.read("key"))

    async def test_both_failures_raised_as_group(
        self, primary, fallback, router, mocker
    ):
        mocker.patch.object(primary, "delete", side_effect=RuntimeError("primary down"))
        mocker.patch.object(
            fallback, "delete", side_effect=RuntimeError("fallback down")
        )

        with pytest.raises(BaseExceptionGroup) as exc_info:
            await router.delete("key")

        messages = {str(e) for e in exc_info.value.exceptions}
        assert messages == {"primary down", "fallback down"}


class TestSize:
    async def test_primary_hit(self, primary, router):
        await primary.write("key", _async_iter(b"primary"))

        assert await router.size("key") == 7

    async def test_falls_back_to_fallback(self, fallback, router):
        await fallback.write("key", _async_iter(b"fallback data"))

        assert await router.size("key") == 13

    async def test_primary_takes_precedence(self, primary, fallback, router):
        await primary.write("key", _async_iter(b"short"))
        await fallback.write("key", _async_iter(b"a longer value"))

        assert await router.size("key") == 5

    async def test_missing_from_both_raises(self, router):
        with pytest.raises(StorageKeyNotFoundError):
            await router.size("missing")


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
