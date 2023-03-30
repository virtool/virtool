import asyncio

import aiojobs.aiohttp
from aiohttp.web import Application

import virtool.http.accept
import virtool.http.errors
import virtool.jobs.auth
from virtool.config.cls import ServerConfig
from virtool.jobs.routes import startup_routes
from virtool.process_utils import create_app_runner, wait_for_restart, wait_for_shutdown
from virtool.startup import (
    startup_data,
    startup_databases,
    startup_events,
    startup_executors,
    startup_http_client,
    startup_sentry,
    startup_settings,
    startup_version,
)
from virtool.types import App


async def create_app(config: ServerConfig):
    """Create the :class:`aiohttp.web.Application` for the jobs API process."""
    app = Application(
        client_max_size=1024**2 * 50,
        middlewares=[
            virtool.http.accept.middleware,
            virtool.jobs.auth.middleware,
            virtool.http.errors.middleware,
        ],
    )

    app["config"] = config
    app["mode"] = "jobs_api_server"

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client,
            startup_databases,
            startup_executors,
            startup_data,
            startup_events,
            startup_routes,
            startup_settings,
            startup_sentry,
        ]
    )

    app.on_shutdown.extend(
        [
            shutdown,
        ]
    )

    return app


async def shutdown(app: App):
    try:
        app["redis"].close()
        await app["redis"].wait_closed()
    except KeyError:
        pass


async def run(config: ServerConfig):
    """
    Run the jobs API server.

    :param config: Any other configuration options as keyword arguments
    """
    app = await create_app(config)
    runner = await create_app_runner(app, config.host, config.port)

    _, pending = await asyncio.wait(
        [
            wait_for_restart(runner, app["events"]),
            wait_for_shutdown(runner, app["events"]),
        ],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for job in pending:
        job.cancel()
