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
    app = web.Application()

    await virtool.app.init_executors(app)

    assert isinstance(app["executor"], concurrent.futures.ThreadPoolExecutor)

    def func(*args):
        return sum(args)

    result = await loop.run_in_executor(None, func, 1, 5, 6, 2)

    assert result == 14
