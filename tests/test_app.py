import os
import pytest
import ssl
import motor.motor_asyncio
import concurrent.futures
from aiohttp import web

import virtool.app
import virtool.app_settings
import virtool.app_dispatcher
import virtool.jobs.manager


@pytest.mark.parametrize("override", [True, False])
async def test_init_db(override, loop, tmpdir, test_db_name):
    """
    Test that the ``db_name`` and ``db`` keys and values are added to the ``app`` object.
    """
    app = web.Application(loop=loop)

    tmpdir.mkdir("samples")

    app["settings"] = {
        "db_name": test_db_name,
        "data_path": str(tmpdir)
    }

    expected_db_name = test_db_name

    if override:
        expected_db_name = "test"
        app["db_name"] = "test"

    await virtool.app.init_db(app)

    assert app["db_name"] == expected_db_name
    assert app["db"].name == expected_db_name
    assert isinstance(app["db"], motor.motor_asyncio.AsyncIOMotorDatabase)

    client = motor.motor_asyncio.AsyncIOMotorClient()

    await client.drop_database(expected_db_name)


async def test_init_executors(loop):
    """
    Test that an instance of :class:`.ThreadPoolExecutor` is added to ``app`` state and that it works.
    """
    app = web.Application(loop=loop)

    virtool.app.init_executors(app)

    assert isinstance(app["executor"], concurrent.futures.ThreadPoolExecutor)

    def func(*args):
        return sum(args)

    result = await app.loop.run_in_executor(None, func, 1, 5, 6, 2)

    assert result == 14


class TestInitSettings:

    async def test_is_instance(self, loop):
        """
        Test that the state value at ``settings`` is an instance of :class:``virtool.app_settings.Settings``.
        """
        app = web.Application(loop=loop)

        await virtool.app.init_settings(app)

        assert isinstance(app["settings"], virtool.app_settings.Settings)

    async def test_load_called(self, monkeypatch, mocker, loop):
        """
        Test that the :meth:`virtool.app_settings.Settings.load` method is called after the settings object is created.
        """
        class MockSettings:

            def __init__(self):
                self.stub = mocker.stub(name="load")

            async def load(self):
                self.stub()

        monkeypatch.setattr("virtool.app_settings.Settings", MockSettings)

        app = web.Application(loop=loop)

        await virtool.app.init_settings(app)

        assert app["settings"].stub.called


def test_init_dispatcher(loop):
    """
    Test that a instance of :class:`~virtool.app_dispatcher.Dispatcher` is attached to the app state.

    """
    app = web.Application(loop=loop)

    virtool.app.init_dispatcher(app)

    assert isinstance(app["dispatcher"], virtool.app_dispatcher.Dispatcher)


async def test_init_job_manager(mocker, loop):
    app = web.Application(loop=loop)

    app["db"] = None
    app["settings"] = None
    app["dispatcher"] = mocker.MagicMock()

    await virtool.app.init_job_manager(app)

    assert isinstance(app["job_manager"], virtool.jobs.manager.Manager)

    assert app["job_manager"].loop == loop
    assert app["job_manager"].db is None
    assert app["job_manager"].settings is None
    assert app["job_manager"].dispatch == app["dispatcher"].dispatch


async def test_configure_ssl(test_files_path):

    cert_path = os.path.join(test_files_path, "test.crt")
    key_path = os.path.join(test_files_path, "test.key")

    ctx = virtool.app.configure_ssl(cert_path, key_path)

    assert isinstance(ctx, ssl.SSLContext)
