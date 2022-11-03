import asyncio
import datetime
import os
import shutil
from pathlib import Path

import arrow
import pytest
from aiohttp.web_exceptions import HTTPBadRequest
from virtool_core.utils import decompress_tgz

import virtool.utils
from virtool.data.errors import ResourceConflictError
from virtool.utils import run_in_thread
from virtool.utils import wait_for_checks


@pytest.fixture(scope="session")
def alphanumeric():
    return "abcdefghijklmnopqrstuvwxyz1234567890"


@pytest.mark.parametrize(
    "document,result",
    [
        (None, None),
        ({"_id": "foo"}, {"id": "foo"}),
        ({"id": "foo"}, {"id": "foo"}),
    ],
)
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
        "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
    )
    m_token_hex.assert_called_with(32)


def test_decompress_tgz(tmp_path):
    path = tmp_path

    src_path = Path.cwd() / "tests" / "test_files" / "virtool.tar.gz"

    shutil.copy(src_path, path)

    decompress_tgz(path / "virtool.tar.gz", path / "de")

    assert set(os.listdir(path)) == {"virtool.tar.gz", "de"}

    assert os.listdir(path / "de") == ["virtool"]

    assert set(os.listdir(path / "de" / "virtool")) == {
        "run",
        "client",
        "VERSION",
        "install.sh",
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


@pytest.mark.parametrize(
    "value,result",
    [
        ("true", True),
        ("1", True),
        ("false", False),
        ("0", False),
    ],
)
def test_to_bool(value, result):
    """
    Test that function converts expected input values correctly.

    """
    assert virtool.utils.to_bool(value) == result


async def test_run_in_thread():

    assert asyncio.iscoroutinefunction(run_in_thread) is True

    def func(*args, **kwargs):
        testsum = 0
        for arg in args:
            testsum += arg
        for value in kwargs.values():
            testsum += value
        return testsum

    assert await run_in_thread(func, 1, 3, 5, key1=5, key2=-4) == 10


@pytest.mark.parametrize("exception", [None, "ResourceConflictErr", "TypeError"])
async def test_wait_for_checks(exception):
    async def check_one():
        _ = 1
        await asyncio.sleep(0.5)

    async def check_two():
        _ = 2
        await asyncio.sleep(1)
        raise ResourceConflictError("Exception thrown for test function check_two")

    async def check_three():
        _ = 3
        await asyncio.sleep(0.5)
        raise HTTPBadRequest(text="Exception thrown for test function check_three")

    async def check_four():
        _ = 4
        await asyncio.sleep(0.25)
        return 4

    if exception == "ResourceConflictErr":
        with pytest.raises(ResourceConflictError) as err:
            await wait_for_checks(check_one(), check_two(), check_three(), check_four())
        assert "check_two" in str(err)
        return

    if exception == "TypeError":
        with pytest.raises(TypeError) as err:
            await wait_for_checks(check_one(), check_four(), check_two())
        assert "Check functions may only return a NoneType object" in str(err)
        return

    assert await wait_for_checks(check_one()) is None
