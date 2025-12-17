import asyncio
from contextlib import suppress

from aiohttp.web import Application
from structlog import get_logger

from virtool.utils import get_http_session_from_app

logger = get_logger("shutdown")


async def shutdown_executors(app: Application) -> None:
    """Attempt to close the `ThreadPoolExecutor` and `ProcessPoolExecutor`.

    :param app: the application object
    """
    with suppress(KeyError):
        app["process_executor"].shutdown(wait=True)


async def shutdown_http_client(app: Application) -> None:
    """Attempt to close the async HTTP client session.

    :param app: The application object
    """
    logger.info("closing http client session")
    await get_http_session_from_app(app).close()


async def shutdown_redis(app: Application) -> None:
    """Attempt to close the application :class:`Redis` instance.

    :param app: the application object
    """
    logger.info("closing redis connection")

    with suppress(KeyError):
        await app["redis"].close()


async def shutdown_scheduler(app: Application) -> None:
    """Cancel all background tasks.

    :param app: The application object
    """
    logger.info("cancelling background tasks")

    background_tasks = app.get("background_tasks", [])
    for task in background_tasks:
        if not task.done():
            task.cancel()

    if background_tasks:
        await asyncio.gather(*background_tasks, return_exceptions=True)
