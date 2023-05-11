import asyncio
import signal
from contextlib import suppress

import aiohttp
import aiohttp.web
import aiojobs
import aiojobs.aiohttp
from aiohttp.web import Application

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
            shutdown_authorization_client,
            shutdown_client,
            shutdown_executors,
            shutdown_scheduler,
            shutdown_redis,
        ]
    )

    return app


def run_task_runner(config: TaskRunnerConfig):
    async def exit_gracefully():
        tasks = [
            task
            for task in asyncio.all_tasks()
            if task is not asyncio.tasks.current_task()
        ]

        for task in tasks:
            task.cancel()

            with suppress(asyncio.CancelledError):
                await task

    loop = asyncio.new_event_loop()

    loop.add_signal_handler(
        signal.SIGINT, lambda: asyncio.ensure_future(exit_gracefully())
    )
    loop.add_signal_handler(
        signal.SIGTERM, lambda: asyncio.ensure_future(exit_gracefully())
    )

    app = create_task_runner_app(config)
    print("before runner")
    with suppress(asyncio.CancelledError):
        aiohttp.web.run_app(
            app=app, host=config.host, port=config.port, loop=loop, handle_signals=False
        )
