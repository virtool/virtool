import pytest


@pytest.fixture
def config(tmp_path, mocker):
    config = mocker.Mock()
    config.data_path = tmp_path
    return config
