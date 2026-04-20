import pytest
from aiohttp.client import ClientSession, ClientTimeout

from tests.config.test_cls import build_server_config
from virtool.startup import startup_http_client_session, startup_storage
from virtool.storage.routing import FallbackStorageRouter


@pytest.fixture
async def fake_app():
    version = "v1.2.3"

    app = {"version": version}

    yield app

    # Close real session created in `test_startup_executors()`.
    try:
        await app["client"].close()
    except (KeyError, TypeError):
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


async def test_startup_storage(fake_app, tmp_path):
    fake_app["config"] = build_server_config(
        data_path=tmp_path,
        storage_backend="filesystem",
    )

    await startup_storage(fake_app)

    assert isinstance(fake_app["storage"], FallbackStorageRouter)
    assert (tmp_path / "storage").is_dir()
