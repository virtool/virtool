import asyncio
from logging import getLogger

from aiohttp.abc import Application
from sentry_sdk import capture_exception

from virtool.data.layer import DataLayer
from virtool.pg.utils import get_row_by_id
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.models import SQLTask
from virtool.tasks.task import BaseTask

logger = getLogger("tasks")


class TaskRunner:
    def __init__(
        self, data: DataLayer, tasks_client: AbstractTasksClient, app: Application
    ):
        self._data = data
        self._tasks_client = tasks_client
        self.app = app

    async def run(self):
        logger.info("Started task runner")

        try:
            while True:
                logger.info("Waiting for next task")

                task_id = await self._tasks_client.pop()

                await self.run_task(task_id)

                logger.info("Finished task: %s", task_id)

        except asyncio.CancelledError:
            logger.info("Stopped task runner")
        except Exception as err:
            logger.fatal("Task runner shutting down due to exception %s", err)
            capture_exception(err)

    async def run_task(self, task_id: int):
        """
        Run task with given `task_id`.

        :param task_id: ID of the task

        """
        task: SQLTask = await get_row_by_id(self.app["pg"], SQLTask, task_id)

        logger.info("Starting task id=%s name=%s", task.id, task.type)

        for cls in BaseTask.__subclasses__():
            if task.type == cls.name:
                current_task = await cls.from_task_id(self.app["data"], task.id)
                await asyncio.get_event_loop().create_task(current_task.run())
