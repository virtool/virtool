import os
import ssl
import pytest
import motor.motor_asyncio
import concurrent.futures
from aiohttp import web

import virtool.app
import virtool.app_settings
import virtool.app_dispatcher
import virtool.job_manager


class TestInitDB:

    async def test(self, loop):
        """
        Test that the ``db_name`` and ``db`` keys and values are added to the ``app`` object.
        
        """
        app = web.Application(loop=loop)

        app["settings"] = {
            "db_name": "foobar"
        }

        await virtool.app.init_db(app)

        assert app["db_name"] == "foobar"
        assert app["db"].name == "foobar"
        assert isinstance(app["db"], motor.motor_asyncio.AsyncIOMotorDatabase)

    async def test_override(self, loop):
        """
        Test that a ``db_name`` value from Virtool settings is overridden by one assigned to ``app`` state with the
        key ``db_name``. This would be used for passing a ``db_name`` from the CLI.        
         
        """
        app = web.Application(loop=loop)

        app["settings"] = {
            "db_name": "foobar"
        }

        app["db_name"] = "test"

        await virtool.app.init_db(app)

        assert app["db_name"] == "test"
        assert app["db"].name == "test"
        assert isinstance(app["db"], motor.motor_asyncio.AsyncIOMotorDatabase)


class TestInitThreadPoolExecutor:

    async def test(self, loop):
        """
        Test that an instance of :class:`.ThreadPoolExecutor` is added to ``app`` state and that it works.
         
        """
        app = web.Application(loop=loop)

        virtool.app.init_thread_pool_executor(app)

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

            def __init__(self, loop):
                self.loop = loop
                self.stub = mocker.stub(name="load")

            async def load(self):
                self.stub()

        monkeypatch.setattr("virtool.app_settings.Settings", MockSettings)

        app = web.Application(loop=loop)

        await virtool.app.init_settings(app)

        assert app["settings"].stub.called


class TestInitDispatcher:

    def test(self, loop):
        """
        Test that a instance of :class:`~virtool.app_dispatcher.Dispatcher` is attached to the app state.
         
        """
        app = web.Application(loop=loop)

        virtool.app.init_dispatcher(app)

        assert isinstance(app["dispatcher"], virtool.app_dispatcher.Dispatcher)


class TestInitJobManager:

    async def test(self, mocker, loop, test_dispatch):
        app = web.Application(loop=loop)

        app["db"] = None
        app["settings"] = None
        app["dispatcher"] = mocker.MagicMock()

        await virtool.app.init_job_manager(app)

        assert isinstance(app["job_manager"], virtool.job_manager.Manager)

        assert app["job_manager"].loop == loop
        assert app["job_manager"].db is None
        assert app["job_manager"].settings is None
        assert app["job_manager"].dispatch == app["dispatcher"].dispatch


class TestConfigureSSL:

    async def test(self, test_files_path):
        cert_path = os.path.join(test_files_path, "test.crt")
        key_path = os.path.join(test_files_path, "test.key")

        with open(cert_path, "r") as handle:
            print(handle.read())

        with open(key_path, "r") as handle:
            print(handle.read())

        ctx = virtool.app.configure_ssl(cert_path, key_path)

        assert isinstance(ctx, ssl.SSLContext)


class TestReload:

    @pytest.mark.parametrize("method", ["execl", "execv"])
    def test(self, method, monkeypatch, mocker):
        monkeypatch.setattr("sys.executable", "python" if method == "execl" else "run")

        execl = mocker.patch("os.execl")
        execv = mocker.patch("os.execv")

        with pytest.raises(SystemError):
            virtool.app.reload()

        assert execl.called is (method == "execl")
        assert execv.called is (method == "execv")

    def test_error(self, monkeypatch):
        monkeypatch.setattr("sys.executable", "foobar")

        with pytest.raises(SystemError):
            virtool.app.reload()
