from pathlib import Path

import pytest


@pytest.fixture
def config(tmp_path: Path, mocker):
    """A mocked Virtool configuration object."""
    config = mocker.Mock()
    config.base_url = "https://virtool.example.com/api"
    config.data_path = tmp_path

    return config
