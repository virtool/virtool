import asyncio
import logging

from aiohttp.abc import Application

from virtool.pg.utils import get_row_by_id
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.models import Task
from virtool.tasks.task import BaseTask

from sentry_sdk import capture_exception


class TaskRunner:
    def __init__(
        self, tasks_client: AbstractTasksClient, app: Application
    ):
        self._tasks_client = tasks_client
        self.app = app
        self._current_task: Task = None

    async def run(self):
        try:
            while True:
                logging.info("Waiting for next task")
                task_id = await self._tasks_client.pop()

                await self.run_task(task_id)

                await asyncio.shield(self._current_task)

                self._current_task = None

                logging.info("Finished task: %s", task_id)

        except asyncio.CancelledError:
            if self._current_task:
                logging.info("Recieved stop signal")

                try:
                    logging.info("Waiting for task to finish: %s", task_id)

                    await asyncio.wait_for(asyncio.shield(self._current_task), 600)

                    logging.info("Finished task: %s", task_id)

                except asyncio.TimeoutError:
                    logging.critical("Task Runner timed out while waiting for task to finish: %s", task_id)

                except asyncio.CancelledError:
                    logging.info("Recieved second kill signal; forcefully ending task: %s", task_id)

            logging.info("Task Runner shutting down")

        except Exception as err:
            logging.fatal("Task Runner shutting down due to exception: %s", err)

            capture_exception(err)

    async def run_task(self, task_id: int):
        """
        Run task with given `task_id`.

        :param task_id: ID of the task

        """
        task: Task = await get_row_by_id(self.app["pg"], Task, task_id)

        logging.info("Starting task id=%s name=%s", task.id, task.type)

        for cls in BaseTask.__subclasses__():
            if task.type == cls.name:
                current_task = await cls.from_task_id(self.app["data"], task.id)

                self._current_task = asyncio.create_task(
                    current_task.run()
                )

                await asyncio.shield(self._current_task)
