from concurrent.futures import ThreadPoolExecutor

import pytest
from aiohttp.client import ClientSession
from aiohttp.web import Application

from virtool.startup import startup_executors, startup_http_client


@pytest.fixture
async def fake_app():
    version = "v1.2.3"

    app = {"version": version}

    yield app

    # Close real session created in `test_startup_executors()`.
    try:
        await app["client"].close()
    except TypeError:
        pass


async def test_startup_executors():
    """
    Test that an instance of :class:`.ThreadPoolExecutor` is added to ``app`` state and that it works.
    """
    app = Application()

    await startup_executors(app)

    assert isinstance(app["executor"], ThreadPoolExecutor)

    def func(*args):
        return sum(args)

    result = await app["run_in_thread"](func, 1, 5, 6, 2)

    assert result == 14


async def test_startup_http_client(loop, fake_app):
    await startup_http_client(fake_app)

    assert fake_app["version"] == "v1.2.3"

    assert isinstance(fake_app["client"], ClientSession)


async def test_startup_http_client_headers(loop, mocker, fake_app):
    m = mocker.patch("aiohttp.client.ClientSession")

    await startup_http_client(fake_app)

    headers = {"User-Agent": "virtool/v1.2.3"}

    m.assert_called_with(headers=headers)
