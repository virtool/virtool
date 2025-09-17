import asyncio
import os
import socket
from asyncio import CancelledError
from asyncio import Task as AsyncioTask

from structlog import get_logger

from virtool.data.errors import ResourceError
from virtool.data.layer import DataLayer
from virtool.tasks.models import Task
from virtool.tasks.task import BaseTask, get_available_task_names, get_task_from_name

logger = get_logger("tasks")


class TaskRunner:
    def __init__(self, data: DataLayer):
        self._data = data
        self._runner_id = f"{socket.gethostname()}-{os.getpid()}"
        self._supported_task_types = get_available_task_names()

        self.current_task: BaseTask | None = None
        """The current Virtool task. This is set to `None` when no task is running."""

        self.asyncio_task: AsyncioTask | None = None
        """The asyncio task running the current Virtool task. This is set to `None` when no task is running."""

    async def run(self) -> None:
        """Start the task runner.

        The task runner polls PostgreSQL for available tasks and runs them.
        The runner will run until a stop signal is received. When a stop signal is
        received, the runner will wait for the current task to finish before exiting.
        """
        logger.info(
            "started task runner",
            runner_id=self._runner_id,
            supported_task_types=self._supported_task_types,
        )

        try:
            while True:
                task = await self._data.tasks.acquire(
                    self._runner_id, self._supported_task_types
                )
                if task is not None:
                    await self._run_task(task.id)
                else:
                    await asyncio.sleep(2)
        except CancelledError:
            await self._shutdown()

    async def _run_task(self, task_id: int):
        """Run a task given a ``task_id``.

        Once the task begins, the current :class:``BaseTask`` object can be accessed at
        ``self.current_task`` and the asyncio task can be accessed at
        ``self.asyncio_task``.

        :param task_id: the ID of the task to run
        """
        task: Task = await self._data.tasks.get(task_id)

        log = logger.bind(id=task_id, name=task.type)

        log.info("starting task")

        try:
            cls = get_task_from_name(task.type)
        except ResourceError as e:
            if "Invalid task name" in str(e):
                log.warning(
                    "encountered invalid task name. skipping task.",
                    name=task.type,
                )
                return

            raise

        self.current_task = await cls.from_task_id(self._data, task_id)
        self.asyncio_task = asyncio.create_task(self.current_task.run())

        await asyncio.shield(self.asyncio_task)

        log.info("Finished task")

    async def _shutdown(self):
        """Gracefully shutdown the task runner.

        Any running task is given a grace period to finish its work. If a kill signal
        is received during the grace period, the task will be forcibly stopped.
        """
        logger.info("received stop signal")

        if self.asyncio_task and not self.asyncio_task.done():
            log = logger.bind(name=self.current_task.name, id=self.current_task.task_id)

            try:
                log.info("waiting for task to finish")
                await self.asyncio_task
                logger.info("finished task")
            except asyncio.CancelledError:
                logger.critical("shutdown forced before task completed")
                raise

        logger.info("closing")
