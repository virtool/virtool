import concurrent.futures

from aiohttp import web

import virtool.app
import virtool.dispatcher
import virtool.settings
import virtool.jobs.manager


async def test_init_executors(loop):
    """
    Test that an instance of :class:`.ThreadPoolExecutor` is added to ``app`` state and that it works.
    """
    app = web.Application(loop=loop)

    await virtool.app.init_executors(app)

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

        assert isinstance(app["settings"], virtool.settings.Settings)

    async def test_load_called(self, mocker, loop):
        """
        Test that the :meth:`virtool.app_settings.Settings.load` method is called after the settings object is created.
        """

        class MockSettings:

            def __init__(self):
                self.stub = mocker.stub(name="load")

            async def load(self):
                self.stub()

        mocker.patch("virtool.settings.Settings", MockSettings)

        app = web.Application(loop=loop)

        await virtool.app.init_settings(app)

        assert app["settings"].stub.called
