import datetime
import os
import shutil
import sys
from pathlib import Path

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


def test_generate_key(mocker):
    """
    Test that API keys are generated using UUID4 and that :func:`generate_api_key()` returns the
    raw and hashed version of the key. Hashing is done through a call to :func:`hash_api_key`.

    """
    m_token_hex = mocker.patch("secrets.token_hex", return_value="foobar")
    assert virtool.utils.generate_key() == (
        "foobar",
        "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
    )
    m_token_hex.assert_called_with(32)


def test_decompress_tgz(tmp_path):
    path = tmp_path

    src_path = Path.cwd() / "tests" / "test_files" / "virtool.tar.gz"

    shutil.copy(src_path, path)

    virtool.utils.decompress_tgz(path / "virtool.tar.gz", path / "de")

    assert set(os.listdir(path)) == {"virtool.tar.gz", "de"}

    assert os.listdir(path / "de") == ["virtool"]

    assert set(os.listdir(path / "de" / "virtool")) == {
        "run",
        "client",
        "VERSION", "install.sh"
    }


class TestRandomAlphanumeric:

    def test_default(self, alphanumeric):
        for _ in range(0, 10):
            result = virtool.utils.random_alphanumeric()
            assert len(result) == 6
            assert all(a in alphanumeric for a in result)

    def test_length(self, alphanumeric):
        for length in [7, 10, 25, 12, 4, 22, 17, 30, 8, 14, 19]:
            result = virtool.utils.random_alphanumeric(length)
            assert len(result) == length
            assert all(a in alphanumeric for a in result)

    def test_excluded(self, alphanumeric):
        for _ in range(0, 5):
            result = virtool.utils.random_alphanumeric(excluded=["87e9wa"])
            assert result != "87e9wa"
            assert len(result) == 6
            assert all(a in alphanumeric for a in result)


@pytest.mark.parametrize("recursive,expected", [
    (True, {"foo.txt"}),
    (False, {"foo.txt", "baz"})
])
def test_rm(recursive, expected, tmp_path):
    """
    Test that a file can be removed and that a folder can be removed when `recursive` is set to
    `True`.

    """
    tmp_path.joinpath("foo.txt").write_text("hello world")
    tmp_path.joinpath("bar.txt").write_text("hello world")
    (tmp_path / "baz").mkdir()

    assert set(os.listdir(tmp_path)) == {"foo.txt", "bar.txt", "baz"}

    virtool.utils.rm(tmp_path / "bar.txt")

    if recursive:
        virtool.utils.rm(
            tmp_path / "baz",
            recursive=recursive
        )
    else:
        with pytest.raises(IsADirectoryError):
            virtool.utils.rm(
                tmp_path / "baz",
                recursive=recursive
            )

    assert set(os.listdir(tmp_path)) == expected


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
    Test that the timestamp util returns a datetime object with the last 3 digits of the
    microsecond frame set to zero.

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
