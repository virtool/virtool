import aiohttp
import aiohttp.web
import aiojobs
import aiojobs.aiohttp
from aiohttp.web import Application

from virtool.api.accept import accept_middleware
from virtool.api.errors import error_middleware
from virtool.config.cls import TaskRunnerConfig, TaskSpawnerConfig
from virtool.shutdown import (
    shutdown_authorization_client,
    shutdown_executors,
    shutdown_http_client,
    shutdown_redis,
    shutdown_scheduler,
)
from virtool.startup import (
    startup_data,
    startup_databases,
    startup_events,
    startup_executors,
    startup_http_client_session,
    startup_sentry,
    startup_task_runner,
    startup_version,
)
from virtool.tasks.api import TaskServicesRootView
from virtool.tasks.startup import (
    startup_databases_for_spawner,
    startup_datalayer_for_spawner,
    startup_task_spawner,
)


def run_task_runner(config: TaskRunnerConfig):
    """Run the task runner service.

    :param config: the task runner configuration object
    """
    app = Application(middlewares=[accept_middleware, error_middleware])

    app["config"] = config
    app["mode"] = "task_runner"

    aiojobs.aiohttp.setup(app, close_timeout=600)

    app.add_routes([aiohttp.web.view("/", TaskServicesRootView)])

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client_session,
            startup_databases,
            startup_executors,
            startup_data,
            startup_events,
            startup_task_runner,
            startup_sentry,
        ],
    )

    app.on_shutdown.extend(
        [
            shutdown_scheduler,
            shutdown_authorization_client,
            shutdown_http_client,
            shutdown_executors,
            shutdown_redis,
        ],
    )

    aiohttp.web.run_app(app=app, host=config.host, port=config.port)


def run_task_spawner(config: TaskSpawnerConfig):
    """Run the task spawner service.

    :param config: the task spawner configuration object
    """
    app = Application(middlewares=[accept_middleware, error_middleware])

    app["config"] = config
    app["mode"] = "task_spawner"

    aiojobs.aiohttp.setup(app)

    app.add_routes([aiohttp.web.view("/", TaskServicesRootView)])

    app.on_startup.extend(
        [
            startup_version,
            startup_sentry,
            startup_http_client_session,
            startup_databases_for_spawner,
            startup_datalayer_for_spawner,
            startup_executors,
            startup_task_spawner,
        ],
    )

    app.on_shutdown.extend(
        [shutdown_http_client, shutdown_executors, shutdown_scheduler, shutdown_redis],
    )

    aiohttp.web.run_app(app=app, host=config.host, port=config.port)
