import asyncio
import logging
import sys

from aiohttp.abc import Application

from virtool.pg.utils import get_row_by_id
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.models import Task
from virtool.tasks.task import BaseTask

from sentry_sdk import capture_exception


SHUTDOWN_TIMEOUT: int = 600


async def shutdown_task_runner(app: Application):
    """
    Raise an `asyncio.CancelledError` in the running task runner.

    :param app: Current running application.
    """
    await app["task_runner"].close(timeout=sys.maxsize)


class TaskRunner:
    def __init__(self, tasks_client: AbstractTasksClient, app: Application):
        self._tasks_client = tasks_client
        self.app = app
        self._current_task: BaseTask = None
        self._current_task_id = None

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
            logging.fatal("Task Runner shutting down due to exception: %s", err)

            capture_exception(err)

    async def _run_task(self):
        """
        Run task given by `self._current_task_id`.
        """
        task: Task = await get_row_by_id(self.app["pg"], Task, self._current_task_id)

        logging.info("Starting task id=%s name=%s", self._current_task_id, task.type)

        for cls in BaseTask.__subclasses__():
            if task.type == cls.name:
                current_task = await cls.from_task_id(
                    self.app["data"], self._current_task_id
                )

                self._current_task = asyncio.create_task(current_task.run())

                await asyncio.shield(self._current_task)

                logging.info("Finished task: %s", self._current_task_id)

                self._current_task = None

                self._current_task_id = None

    async def _shutdown(self):
        """
        Gracefully shutdown the task runner.

        Current task is awaited for SHUTDOWN_TIMEOUT seconds;
        if it exceeds this time or recieves a second kill signal,
        the task is forcefully shut down.
        """
        if self._current_task:
            logging.info("Received stop signal")

            try:
                logging.info("Waiting for task to finish: %s", self._current_task_id)

                await asyncio.wait_for(self._current_task, SHUTDOWN_TIMEOUT)

                logging.info("Finished task: %s", self._current_task_id)

            except asyncio.TimeoutError:
                logging.critical(
                    "Task Runner timed out while waiting for task to finish: %s",
                    self._current_task_id,
                )

        logging.info("Task Runner shutting down")
