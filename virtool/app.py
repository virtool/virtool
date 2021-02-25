import asyncio
import logging

import aiohttp.web
import aiojobs
import aiojobs.aiohttp

import virtool.db.core
import virtool.db.migrate
import virtool.db.utils
import virtool.dispatcher
import virtool.errors
import virtool.hmm.db
import virtool.http.accept
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.jobs.runner
import virtool.logs
import virtool.references.db
import virtool.routes
import virtool.sentry
import virtool.settings.db
import virtool.settings.schema
import virtool.software.db
import virtool.startup
import virtool.utils
import virtool.version
from virtool.process_utils import create_app_runner, wait_for_restart, wait_for_shutdown, logger

logger = logging.getLogger(__name__)


def create_app(config):
    """
    Creates the Virtool application.

    """
    middlewares = [
        virtool.http.csp.middleware,
        virtool.http.auth.middleware,
        virtool.http.accept.middleware,
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    app["config"] = config
    app["mode"] = "server"

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend([
        virtool.startup.init_version,
        virtool.startup.init_events,
        virtool.startup.init_redis,
        virtool.startup.init_db,
        virtool.startup.init_postgres,
        virtool.startup.init_dispatcher,
        virtool.startup.init_settings,
        virtool.startup.init_client_path,
        virtool.startup.init_http_client,
        virtool.startup.init_paths,
        virtool.startup.init_routes,
        virtool.startup.init_executors,
        virtool.startup.init_tasks,
        virtool.startup.init_sentry,
        virtool.startup.init_check_db,
        virtool.startup.init_job_interface,
        virtool.startup.init_refresh
    ])

    app.on_response_prepare.append(virtool.http.csp.on_prepare)
    app.on_shutdown.append(on_shutdown)

    return app


async def run_app(config):
    app = create_app(config)

    runner = await create_app_runner(
        app,
        config["host"],
        config["port"]
    )

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, app["events"]), wait_for_shutdown(runner, app["events"])],
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()


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
