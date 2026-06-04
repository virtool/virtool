import asyncio
from asyncio import CancelledError

from structlog import get_logger

from virtool.tasks.data import TasksData
from virtool.tasks.task import BaseTask

logger = get_logger("periodic_spawner")


class PeriodicTaskSpawner:
    """Spawns periodic tasks for API servers with PostgreSQL-based deduplication."""

    def __init__(self, tasks_datalayer: TasksData):
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
                    task = await self._tasks_datalayer.create_periodic(
                        task_class, interval
                    )

                    if task is not None:
                        logger.info("spawned periodic task", name=task_class.name)

                await asyncio.sleep(30)

        except CancelledError:
            logger.info("stopped periodic task spawner")
