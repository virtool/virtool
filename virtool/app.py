import asyncio
import collections
import logging
import os
import sys

import aiohttp.web
import aiojobs
import aiojobs.aiohttp

import virtool.config
import virtool.db.core
import virtool.db.migrate
import virtool.db.utils
import virtool.dispatcher
import virtool.errors
import virtool.files.manager
import virtool.hmm.db
import virtool.http.accept
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.jobs.manager
import virtool.logs
import virtool.references.db
import virtool.resources
import virtool.routes
import virtool.sentry
import virtool.settings.db
import virtool.settings.schema
import virtool.software.db
import virtool.startup
import virtool.utils
import virtool.version

logger = logging.getLogger(__name__)

INTEGRATED_STARTUP = [
    virtool.startup.init_version,
    virtool.startup.init_events,
    virtool.startup.init_db,
    virtool.startup.init_dispatcher,
    virtool.startup.init_settings,
    virtool.startup.init_client_path,
    virtool.startup.init_http_client,
    virtool.startup.init_paths,
    virtool.startup.init_routes,
    virtool.startup.init_executors,
    virtool.startup.init_sentry,
    virtool.startup.init_check_db,
    virtool.startup.init_resources,
    virtool.startup.init_job_manager,
    virtool.startup.init_file_manager,
    virtool.startup.init_refresh
]

MASTER_SETUP = [
    virtool.startup.init_version,
    virtool.startup.init_events,
    virtool.startup.init_db,
    virtool.startup.init_dispatcher,
    virtool.startup.init_settings,
    virtool.startup.init_client_path,
    virtool.startup.init_http_client,
    virtool.startup.init_paths,
    virtool.startup.init_routes,
    virtool.startup.init_executors,
    virtool.startup.init_redis,
    virtool.startup.init_sentry,
    virtool.startup.init_check_db,
    virtool.startup.init_resources,
    virtool.startup.init_job_manager,
    virtool.startup.init_refresh
]

RUNNER_STARTUP = [
    virtool.startup.init_routes,
    virtool.startup.init_events,
    virtool.startup.init_version,
    virtool.startup.init_db,
    virtool.startup.init_redis,
    virtool.startup.init_settings,
    virtool.startup.init_sentry,
    virtool.startup.init_resources,
    virtool.startup.init_job_manager
]


async def on_shutdown(app: aiohttp.web.Application):
    """
    A function called when the app is shutting down.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    logger.debug("Shutting down")

    try:
        await app["client"].close()
    except KeyError:
        pass

    try:
        await app["dispatcher"].close()
    except KeyError:
        pass

    try:
        app["executor"].shutdown(wait=True)
    except KeyError:
        pass

    try:
        app["process_executor"].shutdown(wait=True)
    except KeyError:
        pass

    scheduler = virtool.startup.get_scheduler_from_app(app)
    await scheduler.close()

    try:
        app["redis"].close()
        await app["redis"].wait_closed()
    except KeyError:
        pass


def create_app(mode, config):
    """
    Creates the Virtool application.

    """
    middlewares = [
        virtool.http.auth.middleware,
        virtool.http.accept.middleware,
        virtool.http.csp.middleware,
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    app["config"] = config
    app["mode"] = mode
    app["change_queue"] = asyncio.Queue()

    aiojobs.aiohttp.setup(app)

    if mode == "integrated":
        app.on_startup.extend(INTEGRATED_STARTUP)
    else:
        app.on_startup.extend(MASTER_SETUP)

    app.on_response_prepare.append(virtool.http.csp.on_prepare)
    app.on_shutdown.append(on_shutdown)

    return app


async def create_app_runner(app: aiohttp.web.Application, host: str, port: int) -> aiohttp.web.AppRunner:
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

    await site.start()

    logger.info(f"Listening at http://{host}:{port}")

    return runner


async def run_app(mode, config):
    app = create_app(mode, config)

    runner = await create_app_runner(app, config["host"], config["port"])

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, app["events"]), wait_for_shutdown(runner, app["events"])],
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()


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
