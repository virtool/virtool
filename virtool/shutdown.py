from aiohttp.web import Application
from structlog import get_logger

from virtool.authorization.client import get_authorization_client_from_app
from virtool.startup import get_scheduler_from_app
from virtool.utils import get_http_session_from_app

logger = get_logger("shutdown")


async def shutdown_authorization_client(app: Application):
    """Attempt to close the OpenFGA client session.

    :param app: The application object
    """
    logger.info("closing authorization client")
    await get_authorization_client_from_app(app).openfga.close()


async def shutdown_executors(app: Application):
    """Attempt to close the `ThreadPoolExecutor` and `ProcessPoolExecutor`.

    :param app: the application object
    """
    try:
        app["process_executor"].shutdown(wait=True)
    except KeyError:
        pass


async def shutdown_http_client(app: Application):
    """Attempt to close the async HTTP client session.

    :param app: The application object
    """
    logger.info("closing HTTP client session")
    await get_http_session_from_app(app).close()


async def shutdown_redis(app: Application):
    """Attempt to close the application :class:`Redis` instance.

    :param app: the application object
    """
    logger.info("closing Redis connection")

    try:
        await app["redis"].close()
    except KeyError:
        ...


async def shutdown_scheduler(app: Application):
    """Attempt to the close the app's `aiojobs` scheduler.

    :param app: The application object
    """
    await get_scheduler_from_app(app).close()
