import logging

import aiohttp.web

import virtool.startup

logger = logging.getLogger(__name__)


async def exit_client(app: aiohttp.web.Application):
    """
    Attempt to close the async HTTP client session.

    :param app: The application object
    """
    try:
        await app["client"].close()
    except KeyError:
        pass


async def exit_dispatcher(app: aiohttp.web.Application):
    """
    Attempt to close the app's `Dispatcher` object.

    :param app: The application object
    """
    try:
        await app["dispatcher"].close()
    except KeyError:
        pass


async def exit_executor(app: aiohttp.web.Application):
    """
    Attempt to close the app's `ThreadPoolExecutor`.

    :param app: The application object
    """
    try:
        app["executor"].shutdown(wait=True)
    except KeyError:
        pass


async def exit_process_executor(app: aiohttp.web.Application):
    """
    Attempt to close the app's `ProcessPoolExecutor`.

    :param app: The application object
    """
    try:
        app["process_executor"].shutdown(wait=True)
    except KeyError:
        pass


async def exit_scheduler(app: aiohttp.web.Application):
    """
    Attempt to the close the app's `aiojobs` scheduler.

    :param app: The application object
    """
    scheduler = virtool.startup.get_scheduler_from_app(app)
    await scheduler.close()


async def exit_redis(app: aiohttp.web.Application):
    """
    Attempt to close the app's `redis` instance.

    :param app: The application object
    """
    try:
        app["redis"].close()
        await app["redis"].wait_closed()
    except KeyError:
        pass
