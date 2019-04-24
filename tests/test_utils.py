import datetime
import os
import shutil
import sys

import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.utils


@pytest.fixture
def fake_dir(tmpdir):
    file_1 = tmpdir.join("hello.txt")
    file_2 = tmpdir.join("world.txt")

    file_1.write("hello world")
    file_2.write("this is a test file")

    return tmpdir


@pytest.fixture(scope="session")
def alphanumeric():
    return "abcdefghijklmnopqrstuvwxyz1234567890"


@pytest.fixture(scope="function")
def randomizer():
    source = ["abc123", "jkl932", "90r2ja", "87e9wa", "skk342", "skl1qq"]

    def function():
        return source.pop()

    return function


@pytest.fixture(scope="function")
def collection():
    return [
        {
            "id": 0,
            "name": "lambert"
        },
        {
            "id": 1,
            "name": "winston"
        },
        {
            "id": 2,
            "name": "stuart"
        },
    ]


def test_decompress_tgz(tmpdir):
    path = str(tmpdir)

    src_path = os.path.join(sys.path[0], "tests", "test_files", "virtool.tar.gz")

    shutil.copy(src_path, path)

    virtool.utils.decompress_tgz(os.path.join(path, "virtool.tar.gz"), os.path.join(path, "de"))

    assert set(os.listdir(path)) == {"virtool.tar.gz", "de"}

    assert os.listdir(os.path.join(path, "de")) == ["virtool"]

    assert set(os.listdir(os.path.join(path, "de", "virtool"))) == {"run", "client", "VERSION", "install.sh"}


class TestRm:

    def test_rm_file(self, fake_dir):
        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt"}

        path = os.path.join(str(fake_dir), "world.txt")

        virtool.utils.rm(path)

        assert set(os.listdir(str(fake_dir))) == {"hello.txt"}

    def test_rm_folder(self, fake_dir):
        fake_dir.mkdir("dummy")

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt", "dummy"}

        path = os.path.join(str(fake_dir), "dummy")

        with pytest.raises(IsADirectoryError):
            virtool.utils.rm(path)

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt", "dummy"}

    def test_rm_folder_recursive(self, fake_dir):
        fake_dir.mkdir("dummy_recursive")

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt", "dummy_recursive"}

        path = os.path.join(str(fake_dir), "dummy_recursive")

        virtool.utils.rm(path, recursive=True)

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt"}


def test_timestamp(mocker):
    """
    Test that the timestamp util returns a datetime object with the last 3 digits of the microsecond frame set to
    zero.

    """
    m = mocker.Mock(return_value=arrow.Arrow(2017, 10, 6, 20, 0, 0, 612304))

    mocker.patch("arrow.utcnow", new=m)

    timestamp = virtool.utils.timestamp()

    assert isinstance(timestamp, datetime.datetime)

    assert timestamp == arrow.arrow.Arrow(2017, 10, 6, 20, 0, 0, 612000).naive


class TestRandomAlphanumeric:

    def test_default(self, alphanumeric):
        for _ in range(0, 10):
            an = virtool.utils.random_alphanumeric()
            assert len(an) == 6
            assert all(l in alphanumeric for l in an)

    def test_length(self, alphanumeric):
        for length in [7, 10, 25, 12, 4, 22, 17, 30, 8, 14, 19]:
            an = virtool.utils.random_alphanumeric(length)
            assert len(an) == length
            assert all(l in alphanumeric for l in an)

    def test_excluded(self, alphanumeric):
        for _ in range(0, 5):
            an = virtool.utils.random_alphanumeric(excluded=["87e9wa"])
            assert an != "87e9wa"
            assert len(an) == 6
            assert all(l in alphanumeric for l in an)


class TestAverageList:

    def test_default(self):
        list1 = [2, 5, 6, 10, 14, 20]
        list2 = [-1, 3, 0, 22, 12, 11]

        expected = [0.5, 4, 3, 16, 13, 15.5]

        assert virtool.utils.average_list(list1, list2) == expected

    def test_mismatched(self):
        with pytest.raises(TypeError):
            virtool.utils.average_list([1, 3, 2, 4], [2, 3, 7])

    def test_wrong_item_type(self):
        with pytest.raises(TypeError):
            virtool.utils.average_list([2, 5, 6], [8, "a", 5])

    def test_wrong_arg_type(self):
        with pytest.raises(TypeError):
            virtool.utils.average_list([2, 5, 6], "a")
