from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from click.testing import CliRunner

import virtool.migration.storage as storage_module
from virtool.cli import cli
from virtool.migration.storage import (
    CATEGORY_PREFIXES,
    StorageMigrationReport,
    StorageVerificationReport,
    build_source_backend,
    migrate_category,
    run_storage_migration,
    verify_category,
)
from virtool.migration.storage_settings import StorageMigrationSettings
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.memory import MemoryStorageProvider


async def _async_iter(data: bytes) -> AsyncIterator[bytes]:
    yield data


async def _collect_bytes(aiter: AsyncIterator[bytes]) -> bytes:
    return b"".join([chunk async for chunk in aiter])


async def _populate(provider, items: dict[str, bytes]) -> None:
    for key, value in items.items():
        await provider.write(key, _async_iter(value))


@pytest.fixture
def source() -> MemoryStorageProvider:
    return MemoryStorageProvider()


@pytest.fixture
def destination() -> MemoryStorageProvider:
    return MemoryStorageProvider()


class TestMigrateCategory:
    async def test_empty_source(self, source, destination):
        report = await migrate_category(source, destination, "samples/")

        assert report == StorageMigrationReport(copied=0, skipped=0, bytes_copied=0)

    async def test_happy_path(self, source, destination):
        contents = {
            "samples/a/reads_1.fq.gz": b"aaaa",
            "samples/a/reads_2.fq.gz": b"bbbbbb",
            "samples/b/reads_1.fq.gz": b"cc",
        }
        await _populate(source, contents)

        report = await migrate_category(source, destination, "samples/")

        assert report == StorageMigrationReport(copied=3, skipped=0, bytes_copied=12)

        for key, value in contents.items():
            assert await _collect_bytes(destination.read(key)) == value

    async def test_idempotency(self, source, destination):
        contents = {
            "samples/a/reads_1.fq.gz": b"aaaa",
            "samples/a/reads_2.fq.gz": b"bbbbbb",
        }
        await _populate(source, contents)

        await migrate_category(source, destination, "samples/")
        report = await migrate_category(source, destination, "samples/")

        assert report == StorageMigrationReport(copied=0, skipped=2, bytes_copied=0)

    async def test_partial_state(self, source, destination):
        contents = {
            "samples/a/reads_1.fq.gz": b"aaaa",
            "samples/a/reads_2.fq.gz": b"bbbbbb",
            "samples/b/reads_1.fq.gz": b"cc",
        }
        await _populate(source, contents)
        await _populate(
            destination,
            {"samples/a/reads_2.fq.gz": b"bbbbbb"},
        )

        report = await migrate_category(source, destination, "samples/")

        assert report == StorageMigrationReport(copied=2, skipped=1, bytes_copied=6)

    async def test_dry_run(self, source, destination, mocker):
        await _populate(source, {"samples/a/reads.fq.gz": b"data"})
        spy = mocker.spy(destination, "write")

        report = await migrate_category(source, destination, "samples/", dry_run=True)

        assert spy.call_count == 0
        assert report.copied == 0
        assert report.skipped == 0

    async def test_prefix_isolation(self, source, destination):
        await _populate(
            source,
            {
                "samples/a/reads.fq.gz": b"sample",
                "indexes/x/reference.json.gz": b"index",
            },
        )

        await migrate_category(source, destination, "samples/")

        assert (
            await _collect_bytes(destination.read("samples/a/reads.fq.gz")) == b"sample"
        )

        info = [info async for info in destination.list("indexes/")]
        assert info == []


class TestVerifyCategory:
    async def test_matches(self, source, destination):
        await _populate(source, {"samples/a": b"x", "samples/b": b"yy"})
        await migrate_category(source, destination, "samples/")

        verification = await verify_category(source, destination, "samples/")

        assert verification == StorageVerificationReport(
            source_count=2,
            destination_count=2,
            missing_keys=[],
            size_mismatches=[],
        )
        assert verification.ok is True

    async def test_missing_and_mismatched(self, source, destination):
        await _populate(
            source,
            {
                "samples/a": b"x",
                "samples/b": b"yy",
                "samples/c": b"zzz",
            },
        )
        await _populate(
            destination,
            {
                "samples/a": b"x",
                "samples/b": b"WRONG_SIZE",
            },
        )

        verification = await verify_category(source, destination, "samples/")

        assert verification.source_count == 3
        assert verification.destination_count == 2
        assert verification.missing_keys == ["samples/c"]
        assert verification.size_mismatches == ["samples/b"]
        assert verification.ok is False


class TestLegacyIndexTranslation:
    async def test_indexes_category_reads_legacy_layout(self, tmp_path: Path):
        ref_id = "ref_alpha"
        index_id = "idx_beta"

        index_dir = tmp_path / "references" / ref_id / index_id
        index_dir.mkdir(parents=True)
        (index_dir / "reference.json.gz").write_bytes(b"index-payload")

        settings = _settings(data_path=tmp_path)
        source = build_source_backend(settings, "indexes")
        destination = MemoryStorageProvider()

        report = await migrate_category(source, destination, "indexes/")

        assert report.copied == 1
        assert (
            await _collect_bytes(
                destination.read(f"indexes/{index_id}/reference.json.gz")
            )
            == b"index-payload"
        )

    def test_non_indexes_category_uses_plain_filesystem(self, tmp_path: Path):
        settings = _settings(data_path=tmp_path)
        source = build_source_backend(settings, "samples")
        assert isinstance(source, FilesystemProvider)


class TestSettings:
    def test_load_from_env_s3(self, monkeypatch, tmp_path):
        monkeypatch.setenv("VT_DATA_PATH", str(tmp_path))
        monkeypatch.setenv("VT_STORAGE_BACKEND", "s3")
        monkeypatch.setenv("VT_STORAGE_S3_BUCKET", "my-bucket")
        monkeypatch.setenv("VT_STORAGE_S3_REGION", "us-west-2")

        settings = StorageMigrationSettings()

        assert settings.data_path == tmp_path
        assert settings.storage_backend == "s3"
        assert settings.storage_s3_bucket == "my-bucket"
        assert settings.storage_s3_region == "us-west-2"

    def test_load_from_env_azure(self, monkeypatch, tmp_path):
        monkeypatch.setenv("VT_DATA_PATH", str(tmp_path))
        monkeypatch.setenv("VT_STORAGE_BACKEND", "azure")
        monkeypatch.setenv("VT_STORAGE_AZURE_ACCOUNT", "acct")
        monkeypatch.setenv("VT_STORAGE_AZURE_CONTAINER", "ctnr")

        settings = StorageMigrationSettings()

        assert settings.storage_backend == "azure"
        assert settings.storage_azure_account == "acct"
        assert settings.storage_azure_container == "ctnr"

    def test_s3_requires_bucket(self, monkeypatch, tmp_path):
        monkeypatch.setenv("VT_DATA_PATH", str(tmp_path))
        monkeypatch.setenv("VT_STORAGE_BACKEND", "s3")
        monkeypatch.delenv("VT_STORAGE_S3_BUCKET", raising=False)

        with pytest.raises(ValueError, match="VT_STORAGE_S3_BUCKET"):
            StorageMigrationSettings()

    def test_s3_partial_credentials_rejected(self, monkeypatch, tmp_path):
        monkeypatch.setenv("VT_DATA_PATH", str(tmp_path))
        monkeypatch.setenv("VT_STORAGE_BACKEND", "s3")
        monkeypatch.setenv("VT_STORAGE_S3_BUCKET", "bkt")
        monkeypatch.setenv("VT_STORAGE_S3_ACCESS_KEY_ID", "AKIA...")
        monkeypatch.setenv("VT_STORAGE_S3_SECRET_ACCESS_KEY", "")

        with pytest.raises(ValueError, match="set together"):
            StorageMigrationSettings()

    def test_azure_requires_account(self, monkeypatch, tmp_path):
        monkeypatch.setenv("VT_DATA_PATH", str(tmp_path))
        monkeypatch.setenv("VT_STORAGE_BACKEND", "azure")
        monkeypatch.delenv("VT_STORAGE_AZURE_ACCOUNT", raising=False)
        monkeypatch.setenv("VT_STORAGE_AZURE_CONTAINER", "ctnr")

        with pytest.raises(ValueError, match="VT_STORAGE_AZURE_ACCOUNT"):
            StorageMigrationSettings()

    def test_azure_requires_container(self, monkeypatch, tmp_path):
        monkeypatch.setenv("VT_DATA_PATH", str(tmp_path))
        monkeypatch.setenv("VT_STORAGE_BACKEND", "azure")
        monkeypatch.setenv("VT_STORAGE_AZURE_ACCOUNT", "acct")
        monkeypatch.delenv("VT_STORAGE_AZURE_CONTAINER", raising=False)

        with pytest.raises(ValueError, match="VT_STORAGE_AZURE_CONTAINER"):
            StorageMigrationSettings()


class TestRunStorageMigration:
    async def test_success(self, tmp_path, mocker):
        settings = _settings(data_path=tmp_path)
        source = MemoryStorageProvider()
        destination = MemoryStorageProvider()
        await _populate(source, {"samples/a": b"x"})

        mocker.patch(
            "virtool.migration.storage.build_source_backend",
            return_value=source,
        )
        mocker.patch(
            "virtool.migration.storage.build_primary_backend",
            return_value=destination,
        )

        await run_storage_migration(settings, "samples", dry_run=False)

        assert await _collect_bytes(destination.read("samples/a")) == b"x"

    async def test_verification_failure_exits_nonzero(self, tmp_path, mocker):
        settings = _settings(data_path=tmp_path)
        source = MemoryStorageProvider()
        destination = MemoryStorageProvider()
        await _populate(source, {"samples/a": b"x"})

        mocker.patch(
            "virtool.migration.storage.build_source_backend",
            return_value=source,
        )
        mocker.patch(
            "virtool.migration.storage.build_primary_backend",
            return_value=destination,
        )
        # Simulate a migration that "succeeds" but writes nothing, so
        # verification finds a missing key.
        mocker.patch(
            "virtool.migration.storage.migrate_category",
            new=AsyncMock(
                return_value=StorageMigrationReport(copied=1, skipped=0, bytes_copied=1)
            ),
        )

        with pytest.raises(SystemExit) as exc_info:
            await run_storage_migration(settings, "samples", dry_run=False)

        assert exc_info.value.code == 1

    async def test_dry_run_skips_verification(self, tmp_path, mocker):
        settings = _settings(data_path=tmp_path)
        source = MemoryStorageProvider()
        destination = MemoryStorageProvider()
        await _populate(source, {"samples/a": b"x"})

        mocker.patch(
            "virtool.migration.storage.build_source_backend",
            return_value=source,
        )
        mocker.patch(
            "virtool.migration.storage.build_primary_backend",
            return_value=destination,
        )

        verify_spy = mocker.spy(storage_module, "verify_category")

        await run_storage_migration(settings, "samples", dry_run=True)

        assert verify_spy.call_count == 0


class TestCLI:
    def test_help(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["migration", "storage", "--help"])

        assert result.exit_code == 0
        assert "--category" in result.output
        assert "--dry-run" in result.output

    def test_category_choices(self):
        runner = CliRunner()
        result = runner.invoke(cli, ["migration", "storage", "--help"])

        for category in CATEGORY_PREFIXES:
            assert category in result.output


def _settings(data_path: Path) -> StorageMigrationSettings:
    return StorageMigrationSettings(
        data_path=data_path,
        storage_backend="s3",
        storage_s3_bucket="test-bucket",
    )
