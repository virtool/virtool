import aiojobs
import aiojobs.aiohttp
from aiohttp import web
from aiohttp.web import Application
from sqlalchemy.util import asyncio

import virtool.http.accept
import virtool.http.errors
from virtool.config import Config
from virtool.dispatcher.events import DispatcherSQLEvents
from virtool.process_utils import create_app_runner, wait_for_restart, wait_for_shutdown
from virtool.shutdown import (
    shutdown_client,
    shutdown_executors,
    shutdown_scheduler,
    shutdown_redis,
    shutdown_authorization_client,
)
from virtool.startup import (
    startup_events,
    startup_http_client,
    startup_databases,
    startup_paths,
    startup_executors,
    startup_data,
    startup_task_runner,
    startup_sentry,
    startup_version,
    startup_fake,
    startup_fake_config,
)
from virtool.tasks.api import TasksRunnerView


async def startup_dispatcher_SQL_listener(app: Application):
    """


    :param app: the app object

    """
    DispatcherSQLEvents(app["dispatcher_interface"].enqueue_change)


async def create_app(config: Config):
    """
    Creates the Virtool application.

    """
    app = Application(
        middlewares=[
            virtool.http.accept.middleware,
            virtool.http.errors.middleware,
        ]
    )

    app["config"] = config
    app["mode"] = "tasks_worker"

    aiojobs.aiohttp.setup(app)

    app.add_routes([web.view("/", TasksRunnerView)])

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client,
            startup_fake_config,
            startup_events,
            startup_databases,
            startup_dispatcher_SQL_listener,
            startup_paths,
            startup_executors,
            startup_fake,
            startup_data,
            startup_task_runner,
            startup_sentry,
        ]
    )

    app.on_shutdown.extend(
        [
            shutdown_authorization_client,
            shutdown_client,
            shutdown_executors,
            shutdown_scheduler,
            shutdown_redis,
        ]
    )

    return app


async def run(config: Config):
    app = await create_app(config)
    runner = await create_app_runner(app, config.host, config.port)
    _, pending = await asyncio.wait(
        [
            wait_for_restart(runner, app["events"]),
            wait_for_shutdown(runner, app["events"]),
        ],
        return_when=asyncio.FIRST_COMPLETED,
    )
