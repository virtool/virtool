import aiohttp.web
import aiojobs
import aiojobs.aiohttp
from aiohttp_pydantic import oas

import virtool.api.accept
import virtool.api.authentication
from virtool.api.response import error_middleware
from virtool.config.cls import Config
from virtool.flags import FeatureFlags, feature_flag_middleware
from virtool.api.headers import headers_middleware, on_prepare_location
from virtool.api.policy import route_policy_middleware
from virtool.routes import setup_routes
from virtool.shutdown import (
    shutdown_authorization_client,
    shutdown_executors,
    shutdown_http_client,
    shutdown_redis,
    shutdown_scheduler,
)
from virtool.startup import (
    startup_b2c,
    startup_check_db,
    startup_data,
    startup_databases,
    startup_events,
    startup_executors,
    startup_http_client_session,
    startup_routes,
    startup_sentry,
    startup_settings,
    startup_version,
    startup_ws,
)


def create_app_without_startup():
    middlewares = [
        headers_middleware,
        virtool.api.authentication.middleware,
        virtool.api.accept.accept_middleware,
        error_middleware,
        route_policy_middleware,
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
        virtool.api.authentication.middleware,
        virtool.api.accept.accept_middleware,
        error_middleware,
        route_policy_middleware,
        feature_flag_middleware,
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    oas.setup(app)

    app["config"] = config
    app["mode"] = "server"
    app["flags"] = FeatureFlags(config.flags)

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client_session,
            startup_databases,
            startup_events,
            startup_routes,
            startup_executors,
            startup_ws,
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
            shutdown_http_client,
            shutdown_executors,
            shutdown_scheduler,
            shutdown_redis,
        ]
    )

    return app


def run_api_server(config: Config):
    app = create_app(config)
    aiohttp.web.run_app(app=app, host=config.host, port=config.port)
