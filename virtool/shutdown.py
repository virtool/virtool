import logging

from aiohttp.web import Application

from virtool.authorization.utils import get_authorization_client_from_app
from virtool.startup import get_scheduler_from_app

logger = logging.getLogger("shutdown")


async def shutdown_client(app: Application):
    """
    Attempt to close the async HTTP client session.

    :param app: The application object
    """
    logger.info("Stopping HTTP client")

    try:
        await app["client"].close()
    except KeyError:
        pass


async def shutdown_authorization_client(app: Application):
    """
    Attempt to close the OpenFGA client session.

    :param app: The application object
    """
    logger.info("Stopping OpenFGA client")
    await get_authorization_client_from_app(app).open_fga.close()


async def shutdown_dispatcher(app: Application):
    """
    Attempt to close the app's `Dispatcher` object.

    :param app: The application object
    """
    logger.info("Stopping dispatcher")

    try:
        await app["dispatcher"].close()
    except KeyError:
        pass


async def shutdown_executors(app: Application):
    """
    Attempt to close the `ThreadPoolExecutor` and `ProcessPoolExecutor`.

    :param app: the application object
    """
    try:
        app["process_executor"].shutdown(wait=True)
    except KeyError:
        pass


async def shutdown_scheduler(app: Application):
    """
    Attempt to the close the app's `aiojobs` scheduler.

    :param app: The application object
    """
    scheduler = get_scheduler_from_app(app)
    await scheduler.close()


async def shutdown_redis(app: Application):
    """
    Attempt to close the app's `redis` instance.

    :param app: The application object
    """
    logger.info("Closing Redis connection")

    try:
        app["redis"].close()
        await app["redis"].wait_closed()
    except KeyError:
        pass
