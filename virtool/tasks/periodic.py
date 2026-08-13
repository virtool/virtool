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

        A failure to spawn one task is logged and skipped. The spawner is the only
        thing that puts periodic work in the queue, so it must survive transient
        database errors instead of leaving the deployment silently without periodic
        tasks until the next restart.

        :param tasks: List of (task_class, interval_seconds) tuples
        """
        try:
            logger.info(
                "started periodic task spawner", tasks=[t[0].name for t in tasks]
            )

            while True:
                for task_class, interval in tasks:
                    try:
                        task = await self._tasks_datalayer.create_periodic(
                            task_class, interval
                        )
                    except Exception:
                        logger.exception(
                            "failed to spawn periodic task", name=task_class.name
                        )
                        continue

                    if task is not None:
                        logger.info("spawned periodic task", name=task_class.name)

                await asyncio.sleep(30)

        except CancelledError:
            logger.info("stopped periodic task spawner")
