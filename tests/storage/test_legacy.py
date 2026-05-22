from pathlib import Path

import pytest

from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.legacy import LegacyIndexFilesystemAdapter


@pytest.fixture
def inner(data_path: Path) -> FilesystemProvider:
    return FilesystemProvider(data_path)


@pytest.fixture
def adapter(inner: FilesystemProvider, data_path: Path) -> LegacyIndexFilesystemAdapter:
    return LegacyIndexFilesystemAdapter(inner, data_path)


def _seed_legacy_index(
    data_path: Path, ref_id: str, index_id: str, filename: str, contents: bytes
) -> Path:
    path = data_path / "references" / ref_id / index_id / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(contents)
    return path


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _collect(aiter) -> list:
    return [item async for item in aiter]


class TestRead:
    async def test_translates_index_key(self, adapter, data_path):
        _seed_legacy_index(data_path, "ref1", "idx1", "reference.json.gz", b"payload")

        result = await _collect_bytes(adapter.read("indexes/idx1/reference.json.gz"))

        assert result == b"payload"

    async def test_passes_through_non_index_key(self, adapter, data_path):
        path = data_path / "samples" / "sample1" / "reads.fq.gz"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"reads")

        result = await _collect_bytes(adapter.read("samples/sample1/reads.fq.gz"))

        assert result == b"reads"

    async def test_unknown_index_raises(self, adapter):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(adapter.read("indexes/missing/reference.json.gz"))

    async def test_index_present_but_file_missing_raises(self, adapter, data_path):
        (data_path / "references" / "ref1" / "idx1").mkdir(parents=True)

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(adapter.read("indexes/idx1/reference.json.gz"))


class TestSize:
    async def test_translates_index_key(self, adapter, data_path):
        _seed_legacy_index(data_path, "ref1", "idx1", "reference.json.gz", b"payload")

        assert await adapter.size("indexes/idx1/reference.json.gz") == len(b"payload")

    async def test_unknown_index_raises(self, adapter):
        with pytest.raises(StorageKeyNotFoundError):
            await adapter.size("indexes/missing/reference.json.gz")

    async def test_passes_through_non_index_key(self, adapter, data_path):
        path = data_path / "samples" / "sample1" / "reads.fq.gz"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"reads")

        assert await adapter.size("samples/sample1/reads.fq.gz") == len(b"reads")


class TestDelete:
    async def test_translates_index_key(self, adapter, data_path):
        path = _seed_legacy_index(
            data_path, "ref1", "idx1", "reference.json.gz", b"payload"
        )

        await adapter.delete("indexes/idx1/reference.json.gz")

        assert not path.exists()

    async def test_unknown_index_is_noop(self, adapter):
        await adapter.delete("indexes/missing/reference.json.gz")

    async def test_passes_through_non_index_key(self, adapter, data_path):
        path = data_path / "samples" / "sample1" / "reads.fq.gz"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"reads")

        await adapter.delete("samples/sample1/reads.fq.gz")

        assert not path.exists()


class TestList:
    async def test_translates_prefix_and_rewrites_keys(self, adapter, data_path):
        _seed_legacy_index(data_path, "ref1", "idx1", "reference.json.gz", b"a")
        _seed_legacy_index(data_path, "ref1", "idx1", "reference.fa.gz", b"bb")

        result = await _collect(adapter.list("indexes/idx1/"))

        keys = sorted(info.key for info in result)
        assert keys == [
            "indexes/idx1/reference.fa.gz",
            "indexes/idx1/reference.json.gz",
        ]

    async def test_unknown_index_yields_nothing(self, adapter):
        assert await _collect(adapter.list("indexes/missing/")) == []

    async def test_passes_through_non_index_prefix(self, adapter, data_path):
        path = data_path / "samples" / "sample1" / "reads.fq.gz"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"reads")

        result = await _collect(adapter.list("samples/sample1/"))

        assert [info.key for info in result] == ["samples/sample1/reads.fq.gz"]

    async def test_does_not_leak_other_indexes(self, adapter, data_path):
        _seed_legacy_index(data_path, "ref1", "idx1", "reference.json.gz", b"a")
        _seed_legacy_index(data_path, "ref1", "idx2", "reference.json.gz", b"b")

        result = await _collect(adapter.list("indexes/idx1/"))

        assert [info.key for info in result] == ["indexes/idx1/reference.json.gz"]


class TestWrite:
    async def test_writes_translated_path(self, adapter, data_path):
        (data_path / "references" / "ref1" / "idx1").mkdir(parents=True)

        size = await adapter.write(
            "indexes/idx1/otus.json.gz", _async_iter(b"compressed")
        )

        assert size == len(b"compressed")
        assert (
            data_path / "references" / "ref1" / "idx1" / "otus.json.gz"
        ).read_bytes() == b"compressed"

    async def test_passes_through_non_index_key(self, adapter, data_path):
        size = await adapter.write("samples/sample1/reads.fq.gz", _async_iter(b"reads"))

        assert size == len(b"reads")
        assert (data_path / "samples" / "sample1" / "reads.fq.gz").read_bytes() == (
            b"reads"
        )

    async def test_unknown_index_raises(self, adapter):
        """A write through the legacy adapter for an unresolvable index_id must
        fail loudly. Falling back to the untranslated key would create a file
        at ``indexes/{id}/...`` on disk that subsequent reads through the same
        adapter could never find.
        """
        with pytest.raises(StorageError, match="cannot write index key"):
            await adapter.write(
                "indexes/missing/otus.json.gz", _async_iter(b"x")
            )


class TestCache:
    async def test_resolves_once_per_index(self, adapter, data_path, mocker):
        _seed_legacy_index(data_path, "ref1", "idx1", "reference.json.gz", b"a")

        spy = mocker.spy(adapter, "_resolve_ref_id")

        await adapter.size("indexes/idx1/reference.json.gz")
        await adapter.size("indexes/idx1/reference.json.gz")
        await _collect(adapter.list("indexes/idx1/"))

        assert spy.call_count == 3
        assert adapter._cache == {"idx1": "ref1"}

    async def test_caches_negative_lookups(self, adapter):
        await adapter.delete("indexes/missing/reference.json.gz")

        assert adapter._cache == {"missing": None}
