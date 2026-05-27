from pathlib import Path

import pytest

from virtool.config.cls import CACHE_STORAGE_BUDGET_BYTES


@pytest.fixture
def config(tmp_path: Path, mocker):
    """A mocked Virtool configuration object."""
    config = mocker.Mock()
    config.base_url = "https://virtool.example.com/api"
    config.storage_fallback_path = tmp_path
    config.cache_storage_budget_bytes = CACHE_STORAGE_BUDGET_BYTES

    return config
