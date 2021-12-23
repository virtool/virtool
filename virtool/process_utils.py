import asyncio
import logging
import os
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
            logger.fatal(f"Could not bind address {(host, port)}")
            sys.exit(1)

    logger.info(f"Listening at http://{host}:{port}")

    return runner


async def wait_for_restart(runner: aiohttp.web.AppRunner, events: dict):
    """
    Wait for the shutdown event and restart if it is encountered.

    Restart is accomplished using :func:`os.execl` or :func:`os.execv` after cleaning up the `runner`.

    :param runner: the :class:`~aiohttp.web.AppRunner` returned by :func:`.create_app_runner`
    :param events: a dict containing the `restart` and `shutdown` :class:`~asyncio.Event` objects

    """
    await events["restart"].wait()
    await asyncio.sleep(0.5)
    await runner.cleanup()

    exe = sys.executable

    if exe.endswith("python") or "python3" in exe:
        os.execl(exe, exe, *sys.argv)
        return

    if exe.endswith("run"):
        os.execv(exe, sys.argv)
        return

    raise SystemError("Could not determine executable type")


async def wait_for_shutdown(runner: aiohttp.web.AppRunner, events: dict):
    """
    Wait for the shutdown event and terminate if it is encountered.

    :param runner: the :class:`~aiohttp.web.AppRunner` returned by :func:`.create_app_runner`
    :param events: a dict containing the `restart` and `shutdown` :class:`~asyncio.Event` objects

    """
    await events["shutdown"].wait()
    await asyncio.sleep(0.5)
    await runner.cleanup()
