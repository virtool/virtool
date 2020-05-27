import pytest
import concurrent.futures

import aiohttp.client
import aiohttp.web

import virtool.app
import virtool.dispatcher
import virtool.startup
import virtool.settings.schema
import virtool.jobs.agent


@pytest.fixture
async def app(loop):
    version = "v1.2.3"

    app = {
        "version": version
    }

    yield app

    # Close real session created in `test_init_executors()`.
    try:
        await app["client"].close()
    except TypeError:
        pass


async def test_init_executors(loop):
    """
    Test that an instance of :class:`.ThreadPoolExecutor` is added to ``app`` state and that it works.
    """
    app = aiohttp.web.Application()

    await virtool.startup.init_executors(app)

    assert isinstance(app["executor"], concurrent.futures.ThreadPoolExecutor)

    def func(*args):
        return sum(args)

    result = await loop.run_in_executor(None, func, 1, 5, 6, 2)

    assert result == 14


async def test_init_http_client(app):
    await virtool.startup.init_http_client(app)

    assert app["version"] == "v1.2.3"

    assert isinstance(app["client"], aiohttp.client.ClientSession)


async def test_init_http_client_headers(mocker, app):
    m = mocker.patch("aiohttp.client.ClientSession")

    await virtool.startup.init_http_client(app)

    headers = {
        "User-Agent": "virtool/v1.2.3"
    }

    m.assert_called_with(headers=headers)
