import datetime
import os
import shutil
import sys

import arrow
import pytest

import virtool.utils


@pytest.fixture(scope="session")
def alphanumeric():
    return "abcdefghijklmnopqrstuvwxyz1234567890"


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


@pytest.mark.parametrize("document,result", [
    (None, None),
    ({"_id": "foo"}, {"id": "foo"}),
    ({"id": "foo"}, {"id": "foo"}),
])
def test_base_processor(document, result):
    assert virtool.utils.base_processor(document) == result


def test_decompress_tgz(tmpdir):
    path = str(tmpdir)

    src_path = os.path.join(sys.path[0], "tests", "test_files", "virtool.tar.gz")

    shutil.copy(src_path, path)

    virtool.utils.decompress_tgz(os.path.join(path, "virtool.tar.gz"), os.path.join(path, "de"))

    assert set(os.listdir(path)) == {"virtool.tar.gz", "de"}

    assert os.listdir(os.path.join(path, "de")) == ["virtool"]

    assert set(os.listdir(os.path.join(path, "de", "virtool"))) == {"run", "client", "VERSION", "install.sh"}


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


@pytest.mark.parametrize("recursive,expected", [
    (True, {"foo.txt"}),
    (False, {"foo.txt", "baz"})
])
def test_rm(recursive, expected, tmpdir):
    """
    Test that a file can be removed and that a folder can be removed when `recursive` is set to `True`.

    """
    tmpdir.join("foo.txt").write("hello world")
    tmpdir.join("bar.txt").write("hello world")
    tmpdir.mkdir("baz")

    assert set(os.listdir(str(tmpdir))) == {"foo.txt", "bar.txt", "baz"}

    virtool.utils.rm(os.path.join(str(tmpdir), "bar.txt"))

    if recursive:
        virtool.utils.rm(
            os.path.join(str(tmpdir), "baz"),
            recursive=recursive
        )
    else:
        with pytest.raises(IsADirectoryError):
            virtool.utils.rm(
                os.path.join(str(tmpdir), "baz"),
                recursive=recursive
            )

    assert set(os.listdir(str(tmpdir))) == expected


@pytest.mark.parametrize("processes", [1, 4])
@pytest.mark.parametrize("which", [None, "/usr/local/bin/pigz"])
def test_should_use_pigz(processes, which, mocker):
    mocker.patch("shutil.which", return_value=which)

    result = virtool.utils.should_use_pigz(processes)

    if processes == 4 and which is not None:
        assert result is True
    else:
        assert result is False


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


@pytest.mark.parametrize("value,result", [
    ("true", True),
    ("1", True),
    ("false", False),
    ("0", False),
])
def test_to_bool(value, result):
    """
    Test that function converts expected input values correctly.

    """
    assert virtool.utils.to_bool(value) == result
