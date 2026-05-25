from pathlib import Path

import pytest

from virtool.config.cls import ServerConfig


def build_server_config(**overrides) -> ServerConfig:
    defaults = {
        "base_url": "",
        "cache_max_size": 10 * 1024**3,
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
        "storage_backend": "s3",
        "storage_s3_bucket": "test-bucket",
    }
    defaults.update(overrides)
    return ServerConfig(**defaults)


class TestStorageBackendRequired:
    def test_missing_raises(self):
        with pytest.raises(TypeError, match="storage_backend"):
            ServerConfig(
                base_url="",
                cache_max_size=10 * 1024**3,
                data_path=Path("./data"),
                dev=False,
                flags=[],
                host="localhost",
                mongodb_connection_string="mongodb://localhost:27017/virtool",
                no_check_db=True,
                no_periodic_tasks=True,
                no_revision_check=True,
                port=9950,
                postgres_connection_string="postgresql://virtool:virtool@localhost/virtool",
                real_ip_header="",
                sentry_dsn="",
            )


class TestCacheMaxSizeValidation:
    def test_non_positive_raises(self):
        with pytest.raises(ValueError, match="cache_max_size"):
            build_server_config(cache_max_size=0)


class TestS3Validation:
    def test_missing_bucket_raises(self):
        with pytest.raises(ValueError, match="storage-s3-bucket"):
            build_server_config(storage_backend="s3", storage_s3_bucket="")

    def test_bucket_only_ok(self):
        config = build_server_config(
            storage_backend="s3",
            storage_s3_bucket="my-bucket",
        )

        assert config.storage_backend == "s3"
        assert config.storage_s3_bucket == "my-bucket"

    def test_partial_credentials_access_key_only_raises(self):
        with pytest.raises(ValueError, match="set together"):
            build_server_config(
                storage_backend="s3",
                storage_s3_bucket="my-bucket",
                storage_s3_access_key_id="AKIAEXAMPLE",
                storage_s3_secret_access_key="",
            )

    def test_partial_credentials_secret_only_raises(self):
        with pytest.raises(ValueError, match="set together"):
            build_server_config(
                storage_backend="s3",
                storage_s3_bucket="my-bucket",
                storage_s3_access_key_id="",
                storage_s3_secret_access_key="secret",
            )

    def test_both_credentials_set_ok(self):
        config = build_server_config(
            storage_backend="s3",
            storage_s3_bucket="my-bucket",
            storage_s3_access_key_id="AKIAEXAMPLE",
            storage_s3_secret_access_key="secret",
        )

        assert config.storage_s3_access_key_id == "AKIAEXAMPLE"
        assert config.storage_s3_secret_access_key == "secret"

    def test_both_credentials_empty_ok(self):
        config = build_server_config(
            storage_backend="s3",
            storage_s3_bucket="my-bucket",
        )

        assert config.storage_s3_access_key_id == ""
        assert config.storage_s3_secret_access_key == ""


class TestAzureValidation:
    def test_missing_account_raises(self):
        with pytest.raises(ValueError, match="storage-azure-account"):
            build_server_config(
                storage_backend="azure",
                storage_s3_bucket="",
                storage_azure_container="some-container",
            )

    def test_missing_container_raises(self):
        with pytest.raises(ValueError, match="storage-azure-container"):
            build_server_config(
                storage_backend="azure",
                storage_s3_bucket="",
                storage_azure_account="some-account",
            )

    def test_account_and_container_ok(self):
        config = build_server_config(
            storage_backend="azure",
            storage_s3_bucket="",
            storage_azure_account="some-account",
            storage_azure_container="some-container",
        )

        assert config.storage_backend == "azure"
        assert config.storage_azure_account == "some-account"
        assert config.storage_azure_container == "some-container"
