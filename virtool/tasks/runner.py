import asyncio
import logging
from asyncio import Task as AsyncioTask

from virtool_core.models.task import Task

from virtool.data.layer import DataLayer
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.task import BaseTask

from sentry_sdk import capture_exception


class TaskRunner:
    def __init__(self, data: DataLayer, tasks_client: AbstractTasksClient):
        self._tasks_client = tasks_client
        self._data = data
        self._current_task: BaseTask | None = None
        self._current_task_runtime: AsyncioTask | None = None

    async def run(self):
        try:
            while True:
                logging.info("Waiting for next task")

                task_id = await self._tasks_client.pop()
                await self._run_task(task_id)

        except asyncio.CancelledError:
            await self._shutdown()
            raise

        except Exception as err:
            logging.fatal("Shutting down due to exception: %s", err)
            capture_exception(err)

    async def _run_task(self, task_id: int):
        """
        Run task given by `self._current_task_id`.
        """
        task_data: Task = await self._data.tasks.get(task_id)

        logging.info("Starting task id=%s name=%s", task_id, task_data.type)

        for cls in BaseTask.__subclasses__():
            if task_data.type == cls.name:
                self._current_task = await cls.from_task_id(self._data, task_id)

                self._current_task_runtime = asyncio.create_task(
                    self._current_task.run()
                )

                await asyncio.shield(self._current_task_runtime)

                logging.info("Finished task: %s", task_id)

    async def _shutdown(self):
        """
        Gracefully shutdown the task runner.

        Any running task is given a grace period to finish its work. If a kill signal
        is received during the grace period, the task will be forcibly stopped.
        """

        logging.info("Received stop signal")

        if self._current_task_runtime and not self._current_task_runtime.done():
            try:
                logging.info(
                    "Waiting for task to finish: %s (id: %s)",
                    self._current_task.name,
                    self._current_task.task_id,
                )
                await self._current_task_runtime
                logging.info(
                    "Finished task: %s (id: %s)",
                    self._current_task.name,
                    self._current_task.task_id,
                )
            except asyncio.CancelledError:
                logging.critical(
                    "Shut down before task finished task to finish: %s (id: %s)",
                    self._current_task.name,
                    self._current_task.task_id,
                )
                raise

        logging.info("Shutting down")
