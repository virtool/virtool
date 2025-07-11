import logging.config

import aiohttp.web
from aiohttp_pydantic import oas

from virtool.api.accept import accept_middleware
from virtool.api.authentication import authentication_middleware
from virtool.api.errors import error_middleware
from virtool.api.headers import headers_middleware, on_prepare_location
from virtool.api.logging import logging_middleware
from virtool.api.policy import route_policy_middleware
from virtool.api.redirects import redirect_middleware
from virtool.api.sessions import session_middleware
from virtool.config.cls import Config
from virtool.flags import FeatureFlags, feature_flag_middleware
from virtool.routes import setup_routes
from virtool.shutdown import (
    shutdown_authorization_client,
    shutdown_executors,
    shutdown_http_client,
    shutdown_redis,
    shutdown_scheduler,
)
from virtool.startup import (
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
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
        }
    )

    middlewares = [
        logging_middleware,
        headers_middleware,
        redirect_middleware,
        error_middleware,
        session_middleware,
        authentication_middleware,
        accept_middleware,
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
        logging_middleware,
        headers_middleware,
        redirect_middleware,
        accept_middleware,
        error_middleware,
        session_middleware,
        authentication_middleware,
        route_policy_middleware,
        feature_flag_middleware,
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    oas.setup(app)

    app["config"] = config
    app["mode"] = "server"
    app["flags"] = FeatureFlags(config.flags)

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
    aiohttp.web.run_app(app=app, host=config.host, port=config.port, access_log=None)
