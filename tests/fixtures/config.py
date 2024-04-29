from pathlib import Path

import pytest


@pytest.fixture
def config(tmp_path, mocker):
    config = mocker.Mock()
    config.base_url = "https://virtool.example.com/api"
    config.data_path = Path(tmp_path)

    return config
