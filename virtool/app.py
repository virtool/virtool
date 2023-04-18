import asyncio
import logging

import aiohttp.web
import aiojobs
import aiojobs.aiohttp
from aiohttp_pydantic import oas

import virtool.http.accept
import virtool.http.authentication
import virtool.http.errors
import virtool.http.query
from virtool.config.cls import Config
from virtool.http.headers import headers_middleware, on_prepare_location
from virtool.http.policy import route_policy_middleware
from virtool.process_utils import create_app_runner
from virtool.routes import setup_routes
from virtool.shutdown import (
    shutdown_authorization_client,
    shutdown_client,
    shutdown_dispatcher,
    shutdown_executors,
    shutdown_redis,
    shutdown_scheduler,
)
from virtool.startup import (
    startup_b2c,
    startup_check_db,
    startup_data,
    startup_databases,
    startup_dispatcher,
    startup_executors,
    startup_http_client,
    startup_paths,
    startup_routes,
    startup_sentry,
    startup_settings,
    startup_version,
)

logger = logging.getLogger(__name__)


def create_app_without_startup():
    middlewares = [
        headers_middleware,
        virtool.http.authentication.middleware,
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
        virtool.http.authentication.middleware,
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
            startup_http_client,
            startup_databases,
            startup_dispatcher,
            startup_paths,
            startup_routes,
            startup_executors,
            startup_data,
            startup_settings,
            startup_sentry,
            startup_check_db,
            startup_b2c,
        ]
    )

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
    await create_app_runner(app, config.host, config.port)
