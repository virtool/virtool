from pathlib import Path

import pytest

from tests.config.test_cls import build_server_config
from virtool.storage.factory import build_primary_backend, create_storage_backend
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.object import ObjectProvider
from virtool.storage.routing import FallbackStorageRouter


class TestCreateStorageBackend:
    def test_s3_wraps_with_fallback_at_data_path(self, tmp_path: Path):
        config = build_server_config(
            data_path=tmp_path,
            storage_backend="s3",
            storage_s3_bucket="bucket",
        )

        backend = create_storage_backend(config)

        assert isinstance(backend, FallbackStorageRouter)
        assert isinstance(backend._primary, ObjectProvider)
        assert isinstance(backend._fallback, FilesystemProvider)
        assert backend._fallback._base_path == tmp_path.resolve()

    def test_azure_wraps_with_fallback_at_data_path(self, tmp_path: Path):
        config = build_server_config(
            data_path=tmp_path,
            storage_backend="azure",
            storage_s3_bucket="",
            storage_azure_account="account",
            storage_azure_container="container",
        )

        backend = create_storage_backend(config)

        assert isinstance(backend, FallbackStorageRouter)
        assert isinstance(backend._primary, ObjectProvider)
        assert backend._fallback._base_path == tmp_path.resolve()

    def test_fallback_root_is_not_data_path_storage(self, tmp_path: Path):
        config = build_server_config(data_path=tmp_path)

        backend = create_storage_backend(config)

        assert backend._fallback._base_path != (tmp_path / "storage").resolve()


class TestBuildPrimaryBackend:
    def test_s3(self, tmp_path: Path):
        config = build_server_config(
            data_path=tmp_path,
            storage_backend="s3",
            storage_s3_bucket="bucket",
        )

        assert isinstance(build_primary_backend(config), ObjectProvider)

    def test_unknown_raises(self, tmp_path: Path):
        config = build_server_config(data_path=tmp_path)
        config.storage_backend = "nonsense"

        with pytest.raises(ValueError, match="Unknown storage_backend"):
            build_primary_backend(config)
