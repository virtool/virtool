import asyncio
import logging

from aiohttp.abc import Application
from virtool_core.models.task import Task

from virtool.data.layer import DataLayer
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.task import BaseTask

from sentry_sdk import capture_exception

SHUTDOWN_TIMEOUT: int = 600
"""
Maximum time in seconds to wait
for a running task to complete
when a kill signal is recieved.

If this time is exceeded,
the task will be forcibly shut down.
"""


async def shutdown_task_runner(app: Application):
    """
    Raise an `asyncio.CancelledError`
    in the running task runner.

    :param app: Current running application.
    """
    await app["task_runner"].close(timeout=float("inf"))


class TaskRunner:
    def __init__(self, data: DataLayer, tasks_client: AbstractTasksClient):
        self._tasks_client = tasks_client
        self._data = data
        self._current_task: BaseTask | None = None
        self._current_task_id: int | None = None

    async def run(self):
        try:
            while True:
                logging.info("Waiting for next task")

                self._current_task_id = await self._tasks_client.pop()

                await self._run_task()

        except asyncio.CancelledError:
            await self._shutdown()
            raise

        except Exception as err:
            logging.fatal("Shutting down due to exception: %s", err)
            capture_exception(err)

    async def _run_task(self):
        """
        Run task given by `self._current_task_id`.
        """
        task: Task = await self._data.tasks.get(self._current_task_id)

        logging.info("Starting task id=%s name=%s", self._current_task_id, task.type)

        for cls in BaseTask.__subclasses__():
            if task.type == cls.name and self._current_task_id is not None:
                current_task = await cls.from_task_id(self._data, self._current_task_id)

                self._current_task = asyncio.create_task(current_task.run())

                await asyncio.shield(self._current_task)

                logging.info("Finished task: %s", self._current_task_id)

                self._current_task = None
                self._current_task_id = None

    async def _shutdown(self):
        """
        Gracefully shutdown the task runner.

        Any running task is given a grace period to finish its work. If a kill signal
        is received during the grace period, the task will be forcibly stopped.
        """

        logging.info("Received stop signal")

        if self._current_task:
            try:
                logging.info("Waiting for task to finish: %s", self._current_task_id)
                await asyncio.wait_for(self._current_task, SHUTDOWN_TIMEOUT)
                logging.info("Finished task: %s", self._current_task_id)
            except asyncio.TimeoutError:
                logging.critical(
                    "Timed out while waiting for task to finish: %s",
                    self._current_task_id,
                )

        logging.info("Shutting down")
