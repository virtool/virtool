import asyncio
from contextlib import suppress
import aiohttp
import aiojobs.aiohttp
import aiohttp.web
from aiohttp.web import Application

import aiojobs

import virtool.http.accept
import virtool.http.errors
from virtool.config.cls import TaskRunnerConfig
from virtool.dispatcher.events import DispatcherSQLEvents
from virtool.shutdown import (
    shutdown_authorization_client,
    shutdown_client,
    shutdown_executors,
    shutdown_redis,
    shutdown_scheduler,
)
from virtool.startup import (
    startup_data,
    startup_databases,
    startup_executors,
    startup_http_client,
    startup_sentry,
    startup_task_runner,
    startup_version,
)
from virtool.tasks.api import TasksRunnerView


async def startup_dispatcher_sql_listener(app: Application):
    """
    Starts  the SQL dispatcher listener. Essential for reporting changes in
    PostgreSQL to the dispatcher for client side updates.

    :param app: the app object

    """
    DispatcherSQLEvents(app["dispatcher_interface"].enqueue_change)


async def create_task_runner_app(config: TaskRunnerConfig):
    """
    Creates task runner application

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

    app.add_routes([aiohttp.web.view("/", TasksRunnerView)])

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client,
            startup_databases,
            startup_dispatcher_sql_listener,
            startup_executors,
            startup_data,
            startup_task_runner,
            startup_sentry,
        ]
    )

    app.on_shutdown.extend(
        [
            shutdown_scheduler,
            shutdown_authorization_client,
            shutdown_client,
            shutdown_executors,
            shutdown_redis,
        ]
    )

    return app


def run_task_runner(config: TaskRunnerConfig):
    app = create_task_runner_app(config)

    aiohttp.web.run_app(
        app=app, host=config.host, port=config.port
    )
