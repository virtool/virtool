from pathlib import Path

import pytest


@pytest.fixture()
def data_path(tmp_path) -> Path:
    """A temporary ``data_path`` directory that is cleaned up after the test."""
    return Path(tmp_path)


@pytest.fixture()
def config(data_path: Path, mocker):
    """A mocked Virtool configuration object."""
    config = mocker.Mock()
    config.base_url = "https://virtool.example.com/api"
    config.data_path = data_path

    return config
