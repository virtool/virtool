import asyncio
import logging

import aiohttp.web
import aiojobs
import aiojobs.aiohttp
from aiohttp_pydantic import oas

import virtool.http.accept
import virtool.http.auth
import virtool.http.errors
import virtool.http.query
from virtool.config.cls import Config
from virtool.http.headers import headers_middleware, on_prepare_location
from virtool.http.policy import route_policy_middleware
from virtool.process_utils import create_app_runner, wait_for_restart, wait_for_shutdown
from virtool.routes import setup_routes
from virtool.shutdown import (
    shutdown_client,
    shutdown_dispatcher,
    shutdown_executors,
    shutdown_redis,
    shutdown_scheduler,
    shutdown_authorization_client,
)
from virtool.startup import (
    startup_b2c,
    startup_check_db,
    startup_task_runner,
    startup_tasks,
    startup_databases,
    startup_data,
    startup_dispatcher,
    startup_events,
    startup_executors,
    startup_http_client,
    startup_paths,
    startup_refresh,
    startup_routes,
    startup_sentry,
    startup_settings,
    startup_version,
)

logger = logging.getLogger(__name__)


def create_app_without_startup():
    middlewares = [
        headers_middleware,
        virtool.http.auth.middleware,
        virtool.http.accept.middleware,
        virtool.http.errors.middleware,
        route_policy_middleware,
        virtool.http.query.middleware,
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    setup_routes(app)
    oas.setup(app)

    return app


def create_app(config: Config):
    """
    Creates the Virtool application.

    """
    middlewares = [
        headers_middleware,
        virtool.http.auth.middleware,
        virtool.http.accept.middleware,
        virtool.http.errors.middleware,
        route_policy_middleware,
        virtool.http.query.middleware,
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    oas.setup(app)

    app["config"] = config
    app["mode"] = "server"

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend(
        [
            startup_version,
            startup_events,
            startup_http_client,
            startup_databases,
            startup_dispatcher,
            startup_paths,
            startup_routes,
            startup_executors,
            startup_data,
            startup_task_runner,
            startup_tasks,
            startup_settings,
            startup_sentry,
            startup_check_db,
            startup_refresh,
        ]
    )

    if config.use_b2c:
        app.on_startup.append(startup_b2c)

    app.on_response_prepare.append(on_prepare_location)

    app.on_shutdown.extend(
        [
            shutdown_authorization_client,
            shutdown_client,
            shutdown_dispatcher,
            shutdown_executors,
            shutdown_scheduler,
            shutdown_redis,
        ]
    )

    return app


async def run_app(config: Config):
    app = create_app(config)

    runner = await create_app_runner(app, config.host, config.port)

    _, pending = await asyncio.wait(
        [
            wait_for_restart(runner, app["events"]),
            wait_for_shutdown(runner, app["events"]),
        ],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
