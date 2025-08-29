import os
from pathlib import Path

import pytest


class MockRequest:
    def __init__(self):
        self.app = {}
        self._state = {}

    def __getitem__(self, key):
        return self._state.get(key)

    def __setitem__(self, key, value):
        self._state[key] = value


@pytest.fixture
def mock_req():
    return MockRequest()


@pytest.fixture
def pwd(tmp_path: Path):
    """Use a temporary directory as the current working directory."""
    prev_dir_path = Path.cwd()
    os.chdir(tmp_path)
    yield tmp_path
    os.chdir(prev_dir_path)
