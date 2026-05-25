from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from click.testing import CliRunner

from virtool.cli import cli
from virtool.migration.storage import CATEGORY_PREFIXES
from virtool.migration.storage_inspect import (
    _classify_remaining,
    _collect_covered_disk_paths,
    _hash_sample,
    _walk_disk,
    run_storage_inspection,
)
from virtool.migration.storage_settings import StorageMigrationSettings
from virtool.storage.memory import MemoryStorageProvider


async def _async_iter(data: bytes) -> AsyncIterator[bytes]:
    yield data


async def _populate(provider, items: dict[str, bytes]) -> None:
    for key, value in items.items():
        await provider.write(key, _async_iter(value))


def _settings(data_path: Path) -> StorageMigrationSettings:
    return StorageMigrationSettings(
        data_path=data_path,
        storage_backend="s3",
        storage_s3_bucket="test-bucket",
    )


def _stage_data_path(data_path: Path) -> dict[str, bytes]:
    """Drop one file per non-indexes category and one legacy index file."""
    contents: dict[str, bytes] = {
        "hmm/profiles.hmm": b"hmm-profile-bytes",
        "files/upload-1.csv": b"upload-bytes",
        "subtractions/sub-1/sub.fa.gz": b"subtraction-bytes",
        "ml/model-1/model.tar.gz": b"ml-bytes",
        "history/hist-1/diff.json": b"history-bytes",
        "samples/samp-1/reads_1.fq.gz": b"sample-bytes",
        "analyses/ana-1/result.json": b"analysis-bytes",
    }

    for rel, value in contents.items():
        path = data_path / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)

    ref_id = "ref-1"
    index_id = "idx-1"
    index_path = data_path / "references" / ref_id / index_id / "reference.json.gz"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_bytes(b"index-bytes")

    return contents | {f"indexes/{index_id}/reference.json.gz": b"index-bytes"}


async def _stage_destination(items: dict[str, bytes]) -> MemoryStorageProvider:
    destination = MemoryStorageProvider()
    await _populate(destination, items)
    return destination


class TestHappyPath:
    async def test_default_sample(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        destination = await _stage_destination(items)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        await run_storage_inspection(
            _settings(tmp_path),
            category=None,
            sample_size=100,
            full_hash=False,
        )

    async def test_full_hash_covers_every_key(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        destination = await _stage_destination(items)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        await run_storage_inspection(
            _settings(tmp_path),
            category=None,
            sample_size=1,
            full_hash=True,
        )

    async def test_single_category(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        destination = await _stage_destination(items)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        await run_storage_inspection(
            _settings(tmp_path),
            category="samples",
            sample_size=100,
            full_hash=False,
        )


class TestFailureModes:
    async def test_invalid_data_path(self, tmp_path: Path):
        with pytest.raises(SystemExit) as exc_info:
            await run_storage_inspection(
                _settings(tmp_path / "nonexistent"),
                category=None,
                sample_size=100,
                full_hash=False,
            )

        assert exc_info.value.code == 1

    async def test_missing_destination_key(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        items_without_one = {
            k: v for k, v in items.items() if k != "samples/samp-1/reads_1.fq.gz"
        }
        destination = await _stage_destination(items_without_one)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        with pytest.raises(SystemExit) as exc_info:
            await run_storage_inspection(
                _settings(tmp_path),
                category=None,
                sample_size=100,
                full_hash=True,
            )

        assert exc_info.value.code == 1

    async def test_size_match_but_content_differs(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        corrupted = dict(items)
        original = items["samples/samp-1/reads_1.fq.gz"]
        corrupted["samples/samp-1/reads_1.fq.gz"] = bytes(b ^ 0xFF for b in original)
        destination = await _stage_destination(corrupted)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        with pytest.raises(SystemExit) as exc_info:
            await run_storage_inspection(
                _settings(tmp_path),
                category=None,
                sample_size=100,
                full_hash=True,
            )

        assert exc_info.value.code == 1

    async def test_orphan_under_references_top_level(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        (tmp_path / "references" / "spurious.txt").write_bytes(b"orphan")
        destination = await _stage_destination(items)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        with pytest.raises(SystemExit) as exc_info:
            await run_storage_inspection(
                _settings(tmp_path),
                category=None,
                sample_size=100,
                full_hash=True,
            )

        assert exc_info.value.code == 1

    async def test_ignored_paths_do_not_fail(self, tmp_path: Path, mocker):
        items = _stage_data_path(tmp_path)
        (tmp_path / "caches").mkdir()
        (tmp_path / "caches" / "stale").write_bytes(b"stale")
        (tmp_path / "logs").mkdir()
        (tmp_path / "logs" / "old.log").write_bytes(b"log")
        (tmp_path / "azcopy_linux_amd64_10.16.1.tar.gz").write_bytes(b"tarball")

        destination = await _stage_destination(items)

        mocker.patch(
            "virtool.migration.storage_inspect.build_primary_backend",
            return_value=destination,
        )

        await run_storage_inspection(
            _settings(tmp_path),
            category=None,
            sample_size=100,
            full_hash=True,
        )


class TestHashSample:
    async def test_source_missing_key_counts_as_mismatch(self):
        """A key missing in source is registered as a mismatch, not an exception."""
        source = MemoryStorageProvider()
        destination = MemoryStorageProvider()
        await _populate(destination, {"present.bin": b"data"})

        mismatches = await _hash_sample(source, destination, ["present.bin"])

        assert mismatches == ["present.bin"]

    async def test_destination_missing_key_counts_as_mismatch(self):
        source = MemoryStorageProvider()
        destination = MemoryStorageProvider()
        await _populate(source, {"present.bin": b"data"})

        mismatches = await _hash_sample(source, destination, ["present.bin"])

        assert mismatches == ["present.bin"]


class TestReport:
    async def test_classification(self, tmp_path: Path):
        """Drive the inner helpers directly to assert report fields."""
        _stage_data_path(tmp_path)
        (tmp_path / "references" / "spurious.txt").write_bytes(b"orphan")
        (tmp_path / "caches").mkdir()
        (tmp_path / "caches" / "stale").write_bytes(b"stale")
        (tmp_path / "azcopy.tar.gz").write_bytes(b"tarball")

        walked = _walk_disk(tmp_path)
        covered = await _collect_covered_disk_paths(_settings(tmp_path))

        orphans, ignored = _classify_remaining(walked, covered)

        assert "references/spurious.txt" in orphans
        assert "caches/stale" in ignored
        assert "azcopy.tar.gz" in ignored


class TestCLI:
    def test_help(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["migration", "storage-inspect", "--help"])

        assert result.exit_code == 0
        assert "--category" in result.output
        assert "--sample-size" in result.output
        assert "--full-hash" in result.output

    def test_category_choices(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["migration", "storage-inspect", "--help"])

        for category in CATEGORY_PREFIXES:
            assert category in result.output
