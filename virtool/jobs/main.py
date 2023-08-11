import aiohttp
import aiojobs.aiohttp
from aiohttp.web import Application
import aiohttp.web
import virtool.http.accept
import virtool.api.response
import virtool.jobs.auth
from virtool.config.cls import ServerConfig
from virtool.jobs.routes import startup_routes
from virtool.startup import (
    startup_data,
    startup_databases,
    startup_executors,
    startup_http_client_session,
    startup_sentry,
    startup_settings,
    startup_version,
    startup_events,
)
from virtool.types import App


async def create_app(config: ServerConfig):
    """Create the :class:`aiohttp.web.Application` for the jobs API process."""
    app = Application(
        client_max_size=1024**2 * 50,
        middlewares=[
            virtool.http.accept.middleware,
            virtool.jobs.auth.middleware,
            virtool.api.response.middleware,
        ],
    )

    app["config"] = config
    app["mode"] = "jobs_api_server"

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client_session,
            startup_databases,
            startup_executors,
            startup_data,
            startup_events,
            startup_routes,
            startup_settings,
            startup_sentry,
        ]
    )

    app.on_shutdown.extend([shutdown])

    return app


async def shutdown(app: App):
    try:
        app["redis"].close()
        await app["redis"].wait_closed()
    except KeyError:
        pass


def run_jobs_server(config: ServerConfig):
    app = create_app(config)
    aiohttp.web.run_app(app=app, host=config.host, port=config.port)
