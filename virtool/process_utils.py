import asyncio
import logging
import signal
import sys

import aiohttp.web

logger = logging.getLogger(__name__)


async def create_app_runner(
    app: aiohttp.web.Application, host: str, port: int
) -> aiohttp.web.AppRunner:
    """
    Create an :class:`aiohttp.web.AppRunner` to allow customization of signal handlers.

    The basic :func:`aiohttp.web.run_app` sets up handlers for `SIGINT` and `SIGTERM` that can interfere with Virtool
    code such as that for restarting the server after software update. This custom runner allows handling of signals
    as well as restart and shutdown events from users.

    https://docs.aiohttp.org/en/stable/web_advanced.html#application-runners

    :param app: the application
    :param host: the host to listen on
    :param port: the port to listen on
    :return: a custom :class:`~aiohttp.web.AppRunner`

    """
    runner = aiohttp.web.AppRunner(app)

    await runner.setup()

    site = aiohttp.web.TCPSite(runner, host, port)

    try:
        await site.start()
    except OSError as err:
        if err.args[0] == 48:
            logger.critical("Could not bind address (%s, %s)", host, port)
            sys.exit(1)

    logger.info("Listening at http://%s:%s", host, port)

    return runner


def add_signal_handlers():
    loop = asyncio.get_event_loop()

    async def shutdown(sig: signal.Signals) -> None:
        """
        Cancel all running async tasks (other than this one) when called.
        By catching asyncio.CancelledError, any running task can perform
        any necessary cleanup when it's cancelled.
        """
        tasks = []
        for task in asyncio.all_tasks(loop):
            if task is not asyncio.current_task(loop):
                task.cancel()
                tasks.append(task)
                
        loop.stop()

    for sig in [signal.SIGINT, signal.SIGTERM]:
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown(sig)))