from pathlib import Path

import pytest

from virtool.config.cls import (
    CACHE_STORAGE_BUDGET_BYTES,
    ServerConfig,
    TaskRunnerConfig,
)


def build_server_config(**overrides) -> ServerConfig:
    defaults = {
        "base_url": "",
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


class TestFallbackPathValidation:
    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="empty string"):
            build_server_config(storage_fallback_path="")

    def test_nonexistent_path_raises(self):
        with pytest.raises(ValueError, match="does not exist"):
            build_server_config(storage_fallback_path="/nonexistent/path/xyz")

    def test_file_path_raises(self, tmp_path: Path):
        f = tmp_path / "not_a_dir.txt"
        f.write_text("x")
        with pytest.raises(ValueError, match="not a directory"):
            build_server_config(storage_fallback_path=f)

    def test_valid_directory_ok(self, tmp_path: Path):
        config = build_server_config(storage_fallback_path=tmp_path)
        assert config.storage_fallback_path == tmp_path


def build_task_runner_config(**overrides) -> TaskRunnerConfig:
    defaults = {
        "base_url": "",
        "host": "localhost",
        "mongodb_connection_string": "mongodb://localhost:27017/virtool",
        "no_revision_check": True,
        "port": 9950,
        "postgres_connection_string": "postgresql://virtool:virtool@localhost/virtool",
        "sentry_dsn": "",
        "storage_backend": "s3",
        "storage_s3_bucket": "test-bucket",
    }
    defaults.update(overrides)
    return TaskRunnerConfig(**defaults)


def test_cache_storage_budget_bytes_default():
    assert (
        build_server_config().cache_storage_budget_bytes == CACHE_STORAGE_BUDGET_BYTES
    )


@pytest.mark.parametrize(
    "build_config", [build_server_config, build_task_runner_config]
)
def test_cache_storage_budget_bytes_must_be_positive(build_config):
    with pytest.raises(ValueError, match="greater than 0"):
        build_config(cache_storage_budget_bytes=0)


class TestStorageBackendRequired:
    def test_missing_raises(self):
        with pytest.raises(TypeError, match="storage_backend"):
            ServerConfig(
                base_url="",
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
