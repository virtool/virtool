from pathlib import Path

import pytest

from tests.config.test_cls import build_server_config
from virtool.storage.factory import create_storage_backend
from virtool.storage.filesystem import FilesystemProvider


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


def test_unknown_backend_raises(tmp_path: Path):
    config = build_server_config(data_path=tmp_path)
    config.storage_backend = "nonsense"

    with pytest.raises(ValueError, match="Unknown storage_backend"):
        create_storage_backend(config)
