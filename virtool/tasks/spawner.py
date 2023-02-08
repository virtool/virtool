import logging
from typing import Type
from typing import Union

import aiojobs
from aiohttp.abc import Application
from sqlalchemy.util import asyncio
from virtool_core.redis import connect

import virtool.pg.utils
from virtool.config import Config
from virtool.data.errors import ResourceError
from virtool.dispatcher.client import DispatcherClient
from virtool.sentry import setup
from virtool.shutdown import (
    shutdown_scheduler,
    shutdown_redis,
)
from virtool.startup import (
    get_scheduler_from_app,
    startup_version,
)
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.tasks.task import BaseTask

logger = logging.getLogger("task_spawner")


async def startup_databases(app: Application):
    """
    Connects to MongoDB, Redis and Postgres concurrently

    :param app: the app object

    """
    postgres_connection_string = app["config"].postgres_connection_string

    redis_connection_string = app["config"].redis_connection_string

    pg, redis = await asyncio.gather(
        virtool.pg.utils.connect(postgres_connection_string),
        connect(redis_connection_string),
    )

    app["redis"] = redis
    dispatcher_interface = DispatcherClient(app["redis"])
    await get_scheduler_from_app(app).spawn(dispatcher_interface.run())

    app.update(
        {
            "dispatcher_interface": dispatcher_interface,
            "pg": pg,
        }
    )


async def startup_tasks_datalayer(app: Application):
    app["tasks_datalayer"] = TasksData(app["pg"], TasksClient(app["redis"]))


async def startup_sentry(app: Union[dict, Application]):
    if (
        not app["config"].no_sentry
        and app["config"].sentry_dsn
        and not app["config"].dev
    ):
        logger.info("Configuring Sentry")
        setup(app["version"], app["config"].sentry_dsn)

    else:
        logger.info("Skipped configuring Sentry")


async def create_app(config: Config):
    """
    Creates the Virtool application.

    """

    app = {"config": config, "mode": "task_spawner", "scheduler": aiojobs.Scheduler()}

    on_startup = [
        startup_version,
        startup_databases,
        startup_tasks_datalayer,
        startup_sentry,
    ]

    for step in on_startup:
        await step(app)

    return app


async def shutdown_app(app):
    shutdown_steps = [
        shutdown_scheduler,
        shutdown_redis,
    ]

    for step in shutdown_steps:
        await step(app)


def get_task_from_name(task_name: str) -> Type[BaseTask]:
    matching_task = [cls for cls in BaseTask.__subclasses__() if cls.name == task_name]

    if len(matching_task) != 1:
        raise ResourceError("Invalid task name")

    return matching_task[0]


async def spawn(config: Config, task_name: str):
    app = await create_app(config)

    task = get_task_from_name(task_name)
    logger.info("Spawning task %s", task.name)

    await app["tasks_datalayer"].create(task)

    await shutdown_app(app)
