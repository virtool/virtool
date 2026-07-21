import aiohttp.web

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
from virtool.shutdown import (
    shutdown_executors,
    shutdown_http_client,
    shutdown_scheduler,
)
from virtool.startup import (
    startup_data,
    startup_databases,
    startup_events,
    startup_executors,
    startup_http_client_session,
    startup_periodic_tasks,
    startup_routes,
    startup_sentry,
    startup_settings,
    startup_storage,
    startup_version,
)


def create_app(config: Config):
    """Creates the Virtool application."""
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

    app["config"] = config
    app["mode"] = "server"
    app["flags"] = FeatureFlags(config.flags)

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client_session,
            startup_databases,
            startup_storage,
            startup_events,
            startup_routes,
            startup_executors,
            startup_data,
            startup_settings,
            startup_sentry,
            startup_periodic_tasks,
        ]
    )

    app.on_response_prepare.append(on_prepare_location)

    app.on_shutdown.extend(
        [
            shutdown_http_client,
            shutdown_executors,
            shutdown_scheduler,
        ]
    )

    return app


def run_api_server(config: Config) -> None:
    app = create_app(config)
    aiohttp.web.run_app(app=app, host=config.host, port=config.port, access_log=None)
