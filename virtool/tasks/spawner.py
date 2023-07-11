import asyncio
from asyncio import CancelledError
from dataclasses import dataclass
from datetime import datetime, timedelta
from logging import getLogger
from typing import Type, List, Tuple

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.tasks.data import TasksData
from virtool.tasks.models import SQLTask
from virtool.tasks.task import BaseTask
from virtool.utils import timestamp

logger = getLogger("spawner")


@dataclass
class PeriodicTask:
    """
    A dataclass that holds information about a periodic task registration.
    """

    task: Type[BaseTask]
    interval: int
    last_triggered: datetime | None = None


class TaskSpawnerService:
    def __init__(self, pg, tasks_datalayer: TasksData):
        self._pg = pg
        self._tasks_datalayer = tasks_datalayer

        self.registered = []

    async def register(self, tasks: List[Tuple[Type[BaseTask], int]]):
        """
        Registers tasks and sets the last triggered time attribute.
        """
        for task, interval in tasks:
            async with AsyncSession(self._pg) as session:
                result = (
                    await session.execute(
                        select(SQLTask)
                        .filter_by(type=str(task.name))
                        .order_by(desc(SQLTask.created_at))
                    )
                ).scalar()
            if result is not None:
                self.registered.append(
                    PeriodicTask(task, interval, last_triggered=result.created_at)
                )
            else:
                self.registered.append(PeriodicTask(task, interval))

    async def run(self, tasks: List[Tuple[Type[BaseTask], int]]):
        """
        Run the task spawner service.

        The task spawner service will periodically check for tasks that need to be run
        and spawn them.

        """
        try:
            await self.register(tasks)

            while True:
                for registered_task in self.registered:
                    await self.check_or_spawn_task(registered_task)

                await asyncio.sleep(self.wait_time)

        except CancelledError:
            logger.info("Stopped Task Spawner")

    @property
    def wait_time(self):
        """
        Time until the next task can be run.
        """
        return min(
            calculate_wait_time(item.interval, item.last_triggered)
            for item in self.registered
        )

    async def check_or_spawn_task(self, periodic_task: PeriodicTask):
        """
        Spawns task if enough time has passed.
        """
        if check_interval_exceeded(
            periodic_task.interval, periodic_task.last_triggered
        ):
            task = await self._tasks_datalayer.create(periodic_task.task)
            logger.info("Spawning task %s", periodic_task.task.name)
            periodic_task.last_triggered = task.created_at

        return periodic_task


def check_interval_exceeded(interval: int, last_triggered: datetime | None):
    """
    Checks whether the time elapsed has exceeded the set interval.
    :param interval: how frequently the task should be triggered in seconds
    :param last_triggered: the time the task was last triggered
    """
    if last_triggered is None:
        return True
    return (timestamp() - last_triggered) >= timedelta(seconds=interval)


def calculate_wait_time(interval: int, last_triggered: datetime | None):
    """
    Calculates the wait time.
    :param interval: how frequently the task should be triggered in seconds
    :param last_triggered: the time the task was last triggered
    """
    return interval - (timestamp() - last_triggered).total_seconds()
