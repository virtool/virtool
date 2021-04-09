from pathlib import Path

import arrow
import os
import pytest
import shutil
import sys
import multidict

SAM_PATH = os.path.join(sys.path[0], "tests", "test_files", "test_al.sam")
SAM_50_PATH = os.path.join(sys.path[0], "tests", "test_files", "sam_50.sam")


class MockRequest:

    def __init__(self):
        self.app = dict()
        self._state = dict()

    def __getitem__(self, key):
        return self._state.get(key)

    def __setitem__(self, key, value):
        self._state[key] = value


class StaticTime:

    datetime = arrow.Arrow(2015, 10, 6, 20, 0, 0).naive
    iso = "2015-10-06T20:00:00Z"


@pytest.fixture
def mock_req():
    return MockRequest()


@pytest.fixture(scope="session")
def md_proxy():
    def func(data_dict=None):
        md = multidict.MultiDict(data_dict or dict())
        return multidict.MultiDictProxy(md)

    return func


@pytest.fixture
def test_files_path():
    return os.path.join(sys.path[0], "tests/test_files")


@pytest.fixture
def test_random_alphanumeric(mocker):
    class RandomAlphanumericTester:

        def __init__(self):
            self.choices = [
                "aB67nm89jL56hj34AL90",
                "fX1l90Rt45JK34bA7890",
                "kl84Fg067jJa109lmQ021",
                "yGlirXr7TSv4x6byFLUJ",
                "G5cPJjvKH7g9lB9tpb3Q",
                "v4xrYERY71lJD1JbIdcX",
                "KfVw9vD27KGMly2qf45K",
                "xjQVxIGHKsTQrVisJiKo",
                "U3cuWAoQ3TDsy0wU7z0l",
                "9PfsOM1B99KfaMz2Wu3C"
            ]

            self.history = list()

            self.last_choice = None

        def __call__(self, length=6, mixed_case=False, excluded=None):
            string = self.choices.pop()[:length]

            if not mixed_case:
                string = string.lower()

            excluded = excluded or list()

            if string in excluded:
                string = self.__call__(length, mixed_case, excluded)

            self.history.append(string)
            self.last_choice = string

            return string

        @property
        def next_choice(self):
            return self.choices[-1]

    return mocker.patch("virtool.utils.random_alphanumeric", new=RandomAlphanumericTester())


@pytest.fixture
def static_nonce(mocker):
    mocker.patch("virtool.http.csp.generate_nonce", return_value="foo1bar2baz3")


@pytest.fixture(scope="session")
def static_time_obj():
    return StaticTime()


@pytest.fixture
def static_time(mocker, static_time_obj):
    mocker.patch("virtool.utils.timestamp", return_value=static_time_obj.datetime)
    return static_time_obj


@pytest.fixture
def test_sam_path(tmpdir):
    path = os.path.join(str(tmpdir.mkdir("test_sam_file")), "test_al.sam")
    shutil.copy(SAM_PATH, path)
    return path


def get_sam_lines():
    with open(SAM_50_PATH, "r") as handle:
        return handle.read().split("\n")[0:-1]


@pytest.fixture(params=get_sam_lines(), ids=lambda x: x.split("\t")[0])
def sam_line(request):
    return request.param.split("\t")


@pytest.fixture
def example_path():
    return Path(__file__).parent.parent.parent / "example"
