import asyncio
import logging

import aiohttp.web
import aiojobs
import aiojobs.aiohttp

import virtool.http.accept
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
from virtool.configuration.config import Config
from virtool.process_utils import create_app_runner, wait_for_restart, wait_for_shutdown
from virtool.shutdown import shutdown_redis, shutdown_executors, shutdown_client, shutdown_scheduler, shutdown_dispatcher
from virtool.startup import startup_executors, startup_db, startup_events, startup_redis, startup_refresh, startup_routes, startup_sentry, \
    startup_settings, startup_paths, startup_tasks, startup_postgres, startup_version, startup_dispatcher, startup_client_path, \
    startup_http_client, startup_jobs_client, startup_task_runner, startup_check_db, startup_b2c

logger = logging.getLogger(__name__)


def create_app(config: Config):
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
        startup_version,
        startup_events,
        startup_redis,
        startup_db,
        startup_postgres,
        startup_dispatcher,
        startup_settings,
        startup_client_path,
        startup_http_client,
        startup_paths,
        startup_routes,
        startup_executors,
        startup_task_runner,
        startup_tasks,
        startup_sentry,
        startup_check_db,
        startup_jobs_client,
        startup_refresh
    ])

    if config.use_b2c:
        app.on_startup.append(startup_b2c)

    app.on_response_prepare.append(virtool.http.csp.on_prepare)

    app.on_shutdown.extend([
        shutdown_client,
        shutdown_dispatcher,
        shutdown_executors,
        shutdown_scheduler,
        shutdown_redis
    ])

    return app


async def run_app(config: Config):
    app = create_app(config)

    runner = await create_app_runner(
        app,
        config.host,
        config.port
    )

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, app["events"]), wait_for_shutdown(runner, app["events"])],
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()
