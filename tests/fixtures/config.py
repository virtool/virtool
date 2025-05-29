from pathlib import Path

import pytest


@pytest.fixture()
def data_path(tmp_path: Path) -> Path:
    """An application data directory that is cleaned up after the test.

    This is the path that is configured in that application with the `--data-path`
    option.
    """
    return tmp_path / "data"


@pytest.fixture()
def config(data_path: Path, mocker):
    """A mocked Virtool configuration object."""
    config = mocker.Mock()
    config.base_url = "https://virtool.example.com/api"
    config.data_path = data_path

    return config
