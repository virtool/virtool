import pytest
from aiohttp.client import ClientSession, ClientTimeout

from virtool.startup import startup_http_client_session


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


async def test_startup_http_client(fake_app):
    await startup_http_client_session(fake_app)
    assert fake_app["version"] == "v1.2.3"
    assert isinstance(fake_app["client"], ClientSession)


async def test_startup_http_client_headers(mocker, fake_app):
    m = mocker.patch("virtool.startup.ClientSession")

    await startup_http_client_session(fake_app)

    expected_timeout = ClientTimeout(total=30, sock_connect=10, sock_read=10)
    m.assert_called_with(
        headers={"User-Agent": "virtool/v1.2.3"},
        timeout=expected_timeout,
    )
