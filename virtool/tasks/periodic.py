import asyncio
from asyncio import CancelledError
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.tasks.data import TasksData
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask
from virtool.utils import timestamp

logger = get_logger("periodic_spawner")


class PeriodicTaskSpawner:
    """Spawns periodic tasks for API servers with PostgreSQL-based deduplication."""

    def __init__(self, pg: AsyncEngine, tasks_datalayer: TasksData):
        self._pg = pg
        self._tasks_datalayer = tasks_datalayer

    async def run(self, tasks: list[tuple[type[BaseTask], int]]) -> None:
        """Run the periodic task spawner.

        :param tasks: List of (task_class, interval_seconds) tuples
        """
        try:
            logger.info(
                "started periodic task spawner", tasks=[t[0].name for t in tasks]
            )

            while True:
                for task_class, interval in tasks:
                    if await self._should_spawn(task_class, interval):
                        logger.info("spawning periodic task", name=task_class.name)
                        await self._tasks_datalayer.create(task_class)

                await asyncio.sleep(30)

        except CancelledError:
            logger.info("stopped periodic task spawner")

    async def _should_spawn(self, task_class: type[BaseTask], interval: int) -> bool:
        """Check if we should spawn a task based on existing incomplete tasks.

        :param task_class: The task class to check
        :param interval: The minimum interval in seconds between tasks
        :return: True if a new task should be spawned
        """
        cutoff_time = timestamp() - timedelta(seconds=interval)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLTask)
                .filter_by(type=task_class.name, complete=False)
                .filter(SQLTask.created_at > cutoff_time)
            )

            existing_task = result.scalar()
            return existing_task is None
