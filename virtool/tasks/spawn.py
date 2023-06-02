import logging
from typing import Type

import aiojobs

from virtool.config.cls import TaskSpawnerConfig, Config
from virtool.data.errors import ResourceError
from virtool.shutdown import shutdown_scheduler, shutdown_redis, shutdown_dispatcher
from virtool.startup import startup_version
from virtool.tasks.task import BaseTask
from virtool.tasks.utils import (
    startup_databases_for_spawner,
    startup_datalayer_for_spawner,
)

logger = logging.getLogger("task_spawner")


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
        shutdown_dispatcher,
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
