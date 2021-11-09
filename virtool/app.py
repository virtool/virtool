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
from virtool.shutdown import exit_redis, exit_executors, exit_client, exit_scheduler, exit_dispatcher
from virtool.startup import init_executors, init_db, init_events, init_redis, init_refresh, init_routes, init_sentry, \
    init_settings, init_paths, init_tasks, init_postgres, init_version, init_dispatcher, init_client_path, \
    init_http_client, init_jobs_client, init_task_runner, init_check_db

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
        init_version,
        init_events,
        init_redis,
        init_db,
        init_postgres,
        init_dispatcher,
        init_settings,
        init_client_path,
        init_http_client,
        init_paths,
        init_routes,
        init_executors,
        init_task_runner,
        init_tasks,
        init_sentry,
        init_check_db,
        init_jobs_client,
        init_refresh
    ])

    app.on_response_prepare.append(virtool.http.csp.on_prepare)

    app.on_shutdown.extend([
        exit_client,
        exit_dispatcher,
        exit_executors,
        exit_scheduler,
        exit_redis
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
