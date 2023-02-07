import logging
from typing import Type

import aiojobs

from virtool.config import Config
from virtool.data.errors import ResourceError
from virtool.data.utils import get_data_from_app
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
    startup_sentry,
    startup_version,
    startup_fake,
    startup_fake_config,
    startup_settings,
)
from virtool.tasks.task import BaseTask

logger = logging.getLogger("task_spawner")


async def create_app(config: Config):
    """
    Creates the Virtool application.

    """

    app = {"config": config, "mode": "task_spawner", "scheduler": aiojobs.Scheduler()}

    on_startup = [
        startup_version,
        startup_http_client,
        startup_fake_config,
        startup_events,
        startup_databases,
        startup_paths,
        startup_executors,
        startup_fake,
        startup_data,
        startup_settings,
        startup_sentry,
    ]

    for step in on_startup:
        await step(app)

    return app


async def shutdown_app(app):
    shutdown_steps = [
        shutdown_authorization_client,
        shutdown_client,
        shutdown_executors,
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

    await get_data_from_app(app).tasks.create(task)

    await shutdown_app(app)
