import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from asyncio import CancelledError
from dataclasses import dataclass
from typing import Type, Optional, List, Tuple
from datetime import datetime, timedelta

from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.hmm.tasks import HMMRefreshTask
from virtool.indexes.tasks import EnsureIndexFilesTask
from virtool.jobs.tasks import TimeoutJobsTask
from virtool.references.tasks import RefreshReferenceReleasesTask, CleanReferencesTask
from virtool.samples.tasks import CompressSamplesTask, MoveSampleFilesTask
from virtool.startup import get_scheduler_from_app
from virtool.subtractions.tasks import (
    AddSubtractionFilesTask,
    CheckSubtractionsFASTATask,
)
from virtool.tasks.data import TasksData

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
import aiohttp.web
from aiohttp.web import Application
import aiojobs
import aiojobs.aiohttp

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
    """

    task: Type[BaseTask]
    interval: float
    task_rerun_time: float = None
    last_triggered: Optional[datetime] = None


class TaskSpawnerService:
    def __init__(self, pg, tasks_datalayer: TasksData):
        self._registered = []
        self._pg = pg
        self._tasks_datalayer = tasks_datalayer

    async def prepare(self, tasks: List[Tuple[Type[BaseTask], float]]):
        """
        Prepares tasks to be run.

        :param tasks: list of tasks and their corresponding intervals
        """
        await self.register(tasks)

        await self.run()

    async def register(self, tasks: List[Tuple[Type[BaseTask], float]]):
        """
        Registers tasks and sets the last triggered time attribute.
        """
        for task, interval in tasks:
            self._registered.append(PeriodicTaskRegistration(task, interval))

            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLTask).filter_by(type=str(task.name))
                )
                task = result.scalar()

            if task is not None:
                self._registered[-1].last_triggered = task.created_at

    async def run(self):
        """
        Run the task spawner service.

        The task spawner service will periodically check for tasks that need to be run
        and spawn them.

        """
        try:
            await self.create_task_for_first_time()

            while True:
                for registered_task in self._registered:
                    await self.check_or_spawn_task(registered_task)

                await asyncio.sleep(self.wait_time)

        except CancelledError:
            logger.info("Stopped Task Spawner")

    @property
    def wait_time(self):
        """
        Sets the wait time.
        """
        return min(
            calculate_wait_time(item.interval, item.last_triggered)
            for item in self._registered
        )

    async def check_or_spawn_task(self, task: PeriodicTaskRegistration):
        """
        Spawns task if enough time has passed.
        """
        if check_elapsed_time_exceeded(task.interval, task.last_triggered):
            await self._tasks_datalayer.create(task.task)
            logger.info("Spawning task %s", task.task)
            task.last_triggered = timestamp()
        return task

    async def create_task_for_first_time(self):
        """
        Creates the task for the first time, if the task has never been run before.
        """
        for registered_task in self._registered:
            if registered_task.last_triggered is None:
                await self._tasks_datalayer.create(registered_task.task)
                logger.info("Spawning task for the first time %s", registered_task.task)
                registered_task.last_triggered = timestamp()


def check_elapsed_time_exceeded(interval: float, last_triggered: Optional[datetime]):
    """
    Checks whether the time elapsed has exceeded the set interval.
    """
    elapsed_time_exceeded = (timestamp() - last_triggered) >= timedelta(
        seconds=interval
    )
    return elapsed_time_exceeded


def calculate_wait_time(interval: float, last_triggered: Optional[datetime]):
    """
    Calculates the wait time.
    """
    wait_time = interval - (timestamp() - last_triggered).total_seconds()
    return wait_time


async def startup_task_spawner(app: App):
    """
    Starts the task spawner.
    """
    scheduler = get_scheduler_from_app(app)

    tasks = [
        (RefreshReferenceReleasesTask, 600),
        (HMMRefreshTask, 600),
        (MigrateFilesTask, 3600),
        (AddSubtractionFilesTask, 3600),
        (EnsureIndexFilesTask, 3600),
        (StoreNuvsFilesTask, 3600),
        (CompressSamplesTask, 3600),
        (MoveSampleFilesTask, 3600),
        (CleanReferencesTask, 3600),
        (CheckSubtractionsFASTATask, 3600),
        (TimeoutJobsTask, 3600),
    ]

    await scheduler.spawn(
        TaskSpawnerService(app["pg"], app["tasks_datalayer"]).prepare(tasks)
    )


async def create_task_spawner_app(config: PeriodicTaskSpawnerConfig):
    """
    Create task spawner application.
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
    """
    Starts the setup of the task spawner application.
    """
    app = create_task_spawner_app(config)
    aiohttp.web.run_app(app=app, host=config.host, port=config.port)
