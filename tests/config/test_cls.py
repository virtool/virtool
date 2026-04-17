from pathlib import Path

import pytest

from virtool.config.cls import ServerConfig


def build_server_config(**overrides) -> ServerConfig:
    defaults = {
        "base_url": "",
        "data_path": Path("./data"),
        "dev": False,
        "flags": [],
        "host": "localhost",
        "mongodb_connection_string": "mongodb://localhost:27017/virtool",
        "no_check_db": True,
        "no_periodic_tasks": True,
        "no_revision_check": True,
        "port": 9950,
        "postgres_connection_string": "postgresql://virtool:virtool@localhost/virtool",
        "real_ip_header": "",
        "sentry_dsn": "",
    }
    defaults.update(overrides)
    return ServerConfig(**defaults)


class TestFilesystemPath:
    def test_defaults_to_data_path_storage(self, data_path: Path):
        config = build_server_config(data_path=data_path)

        assert config.storage_filesystem_path == data_path / "storage"

    def test_explicit_path_preserved(self, tmp_path: Path):
        explicit = tmp_path / "custom-storage"

        config = build_server_config(
            data_path=tmp_path,
            storage_filesystem_path=explicit,
        )

        assert config.storage_filesystem_path == explicit

    def test_string_path_coerced(self, tmp_path: Path):
        config = build_server_config(
            data_path=tmp_path,
            storage_filesystem_path=str(tmp_path / "strpath"),
        )

        assert isinstance(config.storage_filesystem_path, Path)
        assert config.storage_filesystem_path == tmp_path / "strpath"


class TestS3Validation:
    def test_missing_bucket_raises(self):
        with pytest.raises(ValueError, match="storage-s3-bucket"):
            build_server_config(storage_backend="s3")

    def test_bucket_only_ok(self):
        config = build_server_config(
            storage_backend="s3",
            storage_s3_bucket="my-bucket",
        )

        assert config.storage_backend == "s3"
        assert config.storage_s3_bucket == "my-bucket"


class TestAzureValidation:
    def test_missing_account_raises(self):
        with pytest.raises(ValueError, match="storage-azure-account"):
            build_server_config(
                storage_backend="azure",
                storage_azure_container="some-container",
            )

    def test_missing_container_raises(self):
        with pytest.raises(ValueError, match="storage-azure-container"):
            build_server_config(
                storage_backend="azure",
                storage_azure_account="some-account",
            )

    def test_account_and_container_ok(self):
        config = build_server_config(
            storage_backend="azure",
            storage_azure_account="some-account",
            storage_azure_container="some-container",
        )

        assert config.storage_backend == "azure"
        assert config.storage_azure_account == "some-account"
        assert config.storage_azure_container == "some-container"


class TestFilesystemDefault:
    def test_filesystem_backend_needs_no_extra_config(self, data_path: Path):
        config = build_server_config(data_path=data_path)

        assert config.storage_backend == "filesystem"
        assert config.storage_filesystem_path == data_path / "storage"
