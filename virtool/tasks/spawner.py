import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from asyncio import CancelledError
from dataclasses import dataclass
from typing import Type, Optional, List, Tuple
from datetime import datetime, timedelta

from virtool.hmm.tasks import HMMRefreshTask
from virtool.references.tasks import RefreshReferenceReleasesTask
from virtool.startup import get_scheduler_from_app

from virtool.types import App
from virtool.utils import timestamp
from virtool.config.cls import PeriodicTaskSpawnerConfig
from virtool.tasks.task import BaseTask
from virtool.tasks.models import Task as SQLTask
from virtool.tasks.utils import (
    startup_databases_for_spawner,
    startup_datalayer_for_spawner,
)
from virtool.uploads.tasks import MigrateFilesTask
import aiohttp
import aiojobs.aiohttp
import aiohttp.web
from aiohttp.web import Application

import aiojobs

import virtool.http.accept
import virtool.http.errors
from virtool.shutdown import (
    shutdown_client,
    shutdown_executors,
    shutdown_redis,
    shutdown_scheduler,
)
from virtool.startup import (
    startup_executors,
    startup_http_client,
    startup_version,
)
from virtool.tasks.api import TasksSpawnerView

logging.basicConfig(level=logging.DEBUG)

logger = logging.getLogger("periodic_task_spawner")


@dataclass
class PeriodicTaskRegistration:
    """
    A dataclass that holds information about a periodic task registration.
    Task class,
    interval: how frequently the task should be triggered in seconds,
    last triggered: the time the task was triggered and the times are stored as naive UTC datetimes
    """

    task: Type[BaseTask]
    interval: float
    task_rerun_time: float = None
    last_triggered: Optional[datetime] = None


class TaskSpawnerService:
    def __init__(self, app, tasks_datalayer):
        self._registered = []
        self._app = app
        self._tasks_datalayer = tasks_datalayer

    async def prepare(self, tasks: List[Tuple[Type[BaseTask], float]]):
        """
        Register a task with the task spawner service and sets the last triggered time attribute

        :param tasks: list of tasks and their corresponding intervals
        """
        logger.info("In the prepare")
        for task, interval in tasks:
            self._registered.append(PeriodicTaskRegistration(task, interval))

            async with AsyncSession(self._app["pg"]) as session:
                result = await session.execute(
                    select(SQLTask).filter_by(type=str(task.name))
                )
                task = result.scalar()

            if task is not None:
                self._registered[-1].last_triggered = task.created_at

        await self.run()

    async def run(self):
        """
        Run the task spawner service.

        The task spawner service will periodically check for tasks that need to be run
        and spawn them.

        """
        try:
            while True:
                wait_time = 9999

                for registered_task in self._registered:
                    if (timestamp() - registered_task.last_triggered) >= timedelta(
                        seconds=registered_task.interval
                    ):
                        await self._tasks_datalayer.create(registered_task.task)
                        logger.info("Spawning task %s", registered_task.task)
                        registered_task.last_triggered = timestamp()

                    task_wait_time = calculate_wait_time(
                        registered_task.interval, registered_task.last_triggered
                    )

                    wait_time = (
                        wait_time if wait_time < task_wait_time else task_wait_time
                    )

                await asyncio.sleep(wait_time)

        except CancelledError:
            logger.info("Stopped Task Spawner")


def calculate_wait_time(interval, last_triggered):
    wait_time = interval - (timestamp() - last_triggered).total_seconds()
    return wait_time


async def startup_task_spawner(app: App):
    scheduler = get_scheduler_from_app(app)

    tasks = [
        (RefreshReferenceReleasesTask, 600),
        (HMMRefreshTask, 600),
        (MigrateFilesTask, 3600),
    ]

    await scheduler.spawn(
        TaskSpawnerService(app, app["tasks_datalayer"]).prepare(tasks)
    )


async def create_task_spawner_app(config: PeriodicTaskSpawnerConfig):
    """
    Create task spawner application
    """
    app = Application(
        middlewares=[
            virtool.http.accept.middleware,
            virtool.http.errors.middleware,
        ]
    )

    app["config"] = config
    app["mode"] = "periodic_task_spawner"

    aiojobs.aiohttp.setup(app)

    app.add_routes([aiohttp.web.view("/", TasksSpawnerView)])

    app.on_startup.extend(
        [
            startup_version,
            startup_http_client,
            startup_databases_for_spawner,
            startup_datalayer_for_spawner,
            startup_executors,
            startup_task_spawner,
        ]
    )

    app.on_shutdown.extend(
        [
            shutdown_client,
            shutdown_executors,
            shutdown_scheduler,
            shutdown_redis,
        ]
    )

    return app


def run_task_spawner(config: PeriodicTaskSpawnerConfig):
    app = create_task_spawner_app(config)
    aiohttp.web.run_app(app=app, host=config.host, port=config.port)
