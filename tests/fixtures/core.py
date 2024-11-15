import os
from pathlib import Path

import arrow
import pytest
from pytest_mock import MockerFixture

from virtool.example import example_path as virtool_example_path


class MockRequest:
    def __init__(self):
        self.app = {}
        self._state = {}

    def __getitem__(self, key):
        return self._state.get(key)

    def __setitem__(self, key, value):
        self._state[key] = value


class StaticTime:
    datetime = arrow.Arrow(2015, 10, 6, 20, 0, 0).naive
    iso = "2015-10-06T20:00:00Z"


@pytest.fixture()
def mock_req():
    return MockRequest()


@pytest.fixture()
def test_files_path():
    return Path(__file__).parent.parent / "test_files"


@pytest.fixture(scope="session")
def static_time_obj() -> StaticTime:
    return StaticTime()


@pytest.fixture()
def static_time(mocker: MockerFixture, static_time_obj: StaticTime) -> StaticTime:
    mocker.patch("virtool.utils.timestamp", return_value=static_time_obj.datetime)
    return static_time_obj


@pytest.fixture()
def example_path() -> Path:
    return virtool_example_path


@pytest.fixture()
def pwd(tmp_path: Path):
    """Use a temporary directory as the current working directory."""
    prev_dir_path = Path.cwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(prev_dir_path)
