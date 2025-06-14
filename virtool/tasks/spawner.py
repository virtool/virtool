import asyncio
from asyncio import CancelledError
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.tasks.data import TasksData
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask
from virtool.utils import timestamp

logger = get_logger("spawner")


@dataclass
class PeriodicTask:
    """A dataclass that holds information about a periodic task registration."""

    task: type[BaseTask]
    interval: int
    last_triggered: datetime | None = None


class TaskSpawnerService:
    def __init__(self, pg: AsyncEngine, tasks_datalayer: TasksData):
        self._pg = pg
        self._tasks_datalayer = tasks_datalayer

        self.registered = []

    async def register(self, tasks: list[tuple[type[BaseTask], int]]) -> None:
        """Register tasks and set the last triggered time attribute."""
        for task, interval in tasks:
            async with AsyncSession(self._pg) as session:
                result = (
                    await session.execute(
                        select(SQLTask)
                        .filter_by(type=str(task.name))
                        .order_by(desc(SQLTask.created_at)),
                    )
                ).scalar()
            if result is not None:
                self.registered.append(
                    PeriodicTask(task, interval, last_triggered=result.created_at),
                )
            else:
                self.registered.append(PeriodicTask(task, interval))

    async def run(self, tasks: list[tuple[type[BaseTask], int]]) -> None:
        """Run the task spawner service.

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
            logger.info("stopped task spawner")

    @property
    def wait_time(self) -> float:
        """Time until the next task can be run."""
        return min(
            calculate_wait_time(item.interval, item.last_triggered)
            for item in self.registered
        )

    async def check_or_spawn_task(self, periodic_task: PeriodicTask) -> PeriodicTask:
        """Spawns task if enough time has passed."""
        if check_interval_exceeded(
            periodic_task.interval,
            periodic_task.last_triggered,
        ):
            logger.info("spawning task", name=periodic_task.task.name)

            task = await self._tasks_datalayer.create(periodic_task.task)
            periodic_task.last_triggered = task.created_at

        return periodic_task


def check_interval_exceeded(interval: int, last_triggered: datetime | None) -> bool:
    """Check whether the time elapsed has exceeded the set interval.

    :param interval: how frequently the task should be triggered in seconds
    :param last_triggered: the time the task was last triggered
    """
    if last_triggered is None:
        return True
    return (timestamp() - last_triggered) >= timedelta(seconds=interval)


def calculate_wait_time(interval: int, last_triggered: datetime | None) -> float:
    """Calculate the wait time.

    :param interval: how frequently the task should be triggered in seconds
    :param last_triggered: the time the task was last triggered
    """
    return interval - (timestamp() - last_triggered).total_seconds()
