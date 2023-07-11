import asyncio
from asyncio import Task as AsyncioTask, CancelledError
from logging import getLogger

from virtool_core.models.task import Task

from virtool.data.layer import DataLayer
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.task import BaseTask, get_task_from_name

logger = getLogger("tasks")


class TaskRunner:
    def __init__(self, data: DataLayer, tasks_client: AbstractTasksClient):
        self._data = data
        self._tasks_client = tasks_client

        self.current_task: BaseTask | None = None
        """
        The current Virtool task.

        This is set to `None` when no task is running.
        """

        self.asyncio_task: AsyncioTask | None = None
        """
        The asyncio task running the current Virtool task.

        This is set to `None` when no task is running.
        """

    async def run(self):
        """
        Start the task runner.

        The task runner pulls task IDs from the tasks client, fetches them from the
        databases, and runs them.

        The runner will run until a stop signal is received. When a stop signal is
        received, the runner will wait for the current task to finish before exiting.

        """
        logger.info("Started task runner")

        try:
            while True:
                logger.info("Waiting for next task")
                await self._run_task(await self._tasks_client.pop())
        except CancelledError:
            await self._shutdown()

    async def _run_task(self, task_id: int):
        """
        Run a task given a ``task_id``.

        Once the task begins, the current :class:``BaseTask`` object can be accessed at
        ``self.current_task`` and the asyncio task can be accessed at
        ``self.asyncio_task``.

        :param task_id: the ID of the task to run
        """
        sql_task: Task = await self._data.tasks.get(task_id)

        logger.info("Starting task: id=%s name=%s", sql_task.id, sql_task.type)

        cls = get_task_from_name(sql_task.type)

        self.current_task = await cls.from_task_id(self._data, task_id)

        self.asyncio_task = asyncio.create_task(self.current_task.run())

        await asyncio.shield(self.asyncio_task)

        logger.info("Finished task: %s", task_id)

    async def _shutdown(self):
        """
        Gracefully shutdown the task runner.

        Any running task is given a grace period to finish its work. If a kill signal
        is received during the grace period, the task will be forcibly stopped.
        """

        logger.info("Received stop signal")

        if self.asyncio_task and not self.asyncio_task.done():
            try:
                logger.info(
                    "Waiting for task to finish: name=%s id=%s",
                    self.current_task.name,
                    self.current_task.task_id,
                )
                await self.asyncio_task
                logger.info(
                    "Finished task: name=%s id=%s",
                    self.current_task.name,
                    self.current_task.task_id,
                )
            except asyncio.CancelledError:
                logger.critical(
                    "Shutdown forced before task completed: name=%s id=%s",
                    self.current_task.name,
                    self.current_task.task_id,
                )
                raise

        logger.info("Closing")
