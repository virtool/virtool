import pytest

from virtool.config.cls import CACHE_STORAGE_BUDGET


@pytest.fixture
def config(mocker):
    """A mocked Virtool configuration object."""
    config = mocker.Mock()
    config.base_url = "https://virtool.example.com/api"
    config.cache_storage_budget = CACHE_STORAGE_BUDGET

    return config
