import asyncio
import logging
from typing import Type

import aiojobs
from virtool_core.redis import connect

import virtool.pg.utils
from virtool.config import Config, get_config_from_app
from virtool.config.cls import TaskSpawnerConfig
from virtool.data.errors import ResourceError
from virtool.dispatcher.client import DispatcherClient
from virtool.shutdown import shutdown_redis, shutdown_scheduler
from virtool.startup import get_scheduler_from_app, startup_version
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.tasks.task import BaseTask
from virtool.types import App

logger = logging.getLogger("task_spawner")


async def startup_databases_for_spawner(app: App):
    """
    Connects to MongoDB, Redis and Postgres concurrently

    :param app: the app object

    """
    config = get_config_from_app(app)

    pg, redis = await asyncio.gather(
        virtool.pg.utils.connect(config.postgres_connection_string),
        connect(config.redis_connection_string),
    )

    dispatcher_interface = DispatcherClient(redis)
    await get_scheduler_from_app(app).spawn(dispatcher_interface.run())

    app.update(
        {
            "dispatcher_interface": dispatcher_interface,
            "pg": pg,
            "redis": redis,
        }
    )


async def startup_datalayer_for_spawner(app: App):
    app["tasks_datalayer"] = TasksData(app["pg"], TasksClient(app["redis"]))


async def create_spawner_app(config: Config):
    """
    Creates the Virtool application.

    """

    app = {"config": config, "mode": "task_spawner", "scheduler": aiojobs.Scheduler()}

    on_startup = [
        startup_version,
        startup_databases_for_spawner,
        startup_datalayer_for_spawner,
    ]

    for step in on_startup:
        await step(app)

    return app


async def shutdown_spawner_app(app):
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


async def spawn(config: TaskSpawnerConfig, task_name: str):
    app = await create_spawner_app(config)

    task = get_task_from_name(task_name)
    logger.info("Spawning task %s", task.name)

    await app["tasks_datalayer"].create(task)

    await shutdown_spawner_app(app)
