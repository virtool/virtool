from pathlib import Path

import pytest

from tests.config.test_cls import build_server_config
from virtool.storage.factory import create_storage_backend
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.obstore import ObstoreProvider
from virtool.storage.routing import FallbackStorageRouter


class TestFilesystem:
    def test_returns_filesystem_provider(self, tmp_path: Path):
        config = build_server_config(
            data_path=tmp_path,
            storage_backend="filesystem",
        )

        backend = create_storage_backend(config)

        assert isinstance(backend, FilesystemProvider)

    def test_creates_base_directory(self, tmp_path: Path):
        target = tmp_path / "nested" / "storage"

        config = build_server_config(
            data_path=tmp_path,
            storage_backend="filesystem",
            storage_filesystem_path=target,
        )

        create_storage_backend(config)

        assert target.is_dir()


class TestS3:
    def test_constructs_s3_store(self, tmp_path: Path, mocker):
        s3_store = mocker.patch("obstore.store.S3Store")

        config = build_server_config(
            data_path=tmp_path,
            storage_backend="s3",
            storage_s3_bucket="my-bucket",
            storage_s3_region="us-west-2",
            storage_s3_access_key_id="AKIA",
            storage_s3_secret_access_key="SECRET",
            storage_s3_endpoint="https://s3.example.com",
        )

        backend = create_storage_backend(config)

        assert isinstance(backend, FallbackStorageRouter)
        assert isinstance(backend._primary, ObstoreProvider)
        assert isinstance(backend._fallback, FilesystemProvider)
        s3_store.assert_called_once_with(
            "my-bucket",
            region="us-west-2",
            endpoint="https://s3.example.com",
            access_key_id="AKIA",
            secret_access_key="SECRET",
        )

    def test_omits_empty_optional_kwargs(self, tmp_path: Path, mocker):
        s3_store = mocker.patch("obstore.store.S3Store")

        config = build_server_config(
            data_path=tmp_path,
            storage_backend="s3",
            storage_s3_bucket="my-bucket",
        )

        create_storage_backend(config)

        s3_store.assert_called_once_with("my-bucket")


class TestAzure:
    def test_constructs_azure_store(self, tmp_path: Path, mocker):
        azure_store = mocker.patch("obstore.store.AzureStore")

        config = build_server_config(
            data_path=tmp_path,
            storage_backend="azure",
            storage_azure_account="account",
            storage_azure_container="container",
            storage_azure_access_key="KEY",
        )

        backend = create_storage_backend(config)

        assert isinstance(backend, FallbackStorageRouter)
        assert isinstance(backend._primary, ObstoreProvider)
        assert isinstance(backend._fallback, FilesystemProvider)
        azure_store.assert_called_once_with(
            "container",
            account="account",
            access_key="KEY",
        )

    def test_omits_empty_access_key(self, tmp_path: Path, mocker):
        azure_store = mocker.patch("obstore.store.AzureStore")

        config = build_server_config(
            data_path=tmp_path,
            storage_backend="azure",
            storage_azure_account="account",
            storage_azure_container="container",
        )

        create_storage_backend(config)

        azure_store.assert_called_once_with("container", account="account")


def test_unknown_backend_raises(tmp_path: Path):
    config = build_server_config(data_path=tmp_path)
    config.storage_backend = "nonsense"

    with pytest.raises(ValueError, match="Unknown storage_backend"):
        create_storage_backend(config)
