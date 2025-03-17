"""Setup the server process."""

import aiojobs
import aiojobs.aiohttp
from aiohttp.web import run_app
from aiohttp.web_app import Application

from virtool.api.accept import accept_middleware
from virtool.api.authentication import authentication_middleware
from virtool.api.errors import error_middleware
from virtool.api.headers import headers_middleware, on_prepare_location
from virtool.api.logging import logging_middleware
from virtool.api.policy import route_policy_middleware
from virtool.api.sessions import session_middleware
from virtool.config.cls import Config
from virtool.flags import FeatureFlags, feature_flag_middleware
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


def create_app(config: Config) -> Application:
    """Create the Virtool application."""
    middlewares = [
        logging_middleware,
        headers_middleware,
        accept_middleware,
        error_middleware,
        session_middleware,
        authentication_middleware,
        route_policy_middleware,
        feature_flag_middleware,
    ]

    app = Application(middlewares=middlewares)

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
        ],
    )

    app.on_response_prepare.append(on_prepare_location)

    app.on_shutdown.extend(
        [
            shutdown_authorization_client,
            shutdown_http_client,
            shutdown_executors,
            shutdown_scheduler,
            shutdown_redis,
        ],
    )

    return app


def run_api_server(config: Config) -> None:
    """Create and run the web API server."""
    app = create_app(config)
    run_app(app=app, host=config.host, port=config.port, access_log=None)
