import aiohttp
import aiohttp.web
from aiohttp.web import Application

import virtool.health.api
from virtool.api.accept import accept_middleware
from virtool.api.errors import error_middleware
from virtool.config.cls import TaskRunnerConfig
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
    startup_sentry,
    startup_storage,
    startup_task_runner,
    startup_version,
)
from virtool.tasks.api import TaskServicesRootView


async def create_app(config: TaskRunnerConfig) -> Application:
    """Create the :class:`aiohttp.web.Application` for the task runner process.

    :param config: the task runner configuration object
    """
    app = Application(middlewares=[accept_middleware, error_middleware])

    app["config"] = config
    app["mode"] = "task_runner"

    app.add_routes([aiohttp.web.view("/", TaskServicesRootView)])
    app.add_routes(virtool.health.api.routes)

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client_session,
            startup_databases,
            startup_executors,
            startup_storage,
            startup_data,
            startup_events,
            startup_task_runner,
            startup_sentry,
        ],
    )

    app.on_shutdown.extend(
        [
            shutdown_scheduler,
            shutdown_http_client,
            shutdown_executors,
        ],
    )

    return app


def run_task_runner(config: TaskRunnerConfig) -> None:
    """Run the task runner service.

    :param config: the task runner configuration object
    """
    aiohttp.web.run_app(app=create_app(config), host=config.host, port=config.port)
