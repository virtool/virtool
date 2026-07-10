import pytest

from tests.config.test_cls import build_server_config
from virtool.storage.factory import create_storage_backend
from virtool.storage.object import ObjectProvider


class TestCreateStorageBackend:
    def test_s3(self):
        config = build_server_config(
            storage_backend="s3",
            storage_s3_bucket="bucket",
        )

        assert isinstance(create_storage_backend(config), ObjectProvider)

    def test_azure(self):
        config = build_server_config(
            storage_backend="azure",
            storage_s3_bucket="",
            storage_azure_account="account",
            storage_azure_container="container",
        )

        assert isinstance(create_storage_backend(config), ObjectProvider)

    def test_unknown_raises(self):
        config = build_server_config()
        config.storage_backend = "nonsense"

        with pytest.raises(ValueError, match="Unknown storage_backend"):
            create_storage_backend(config)
