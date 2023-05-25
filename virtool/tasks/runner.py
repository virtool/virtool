import asyncio
from contextlib import suppress
import logging
import time

from aiohttp.abc import Application
import async_timeout

from virtool.data.layer import DataLayer
from virtool.pg.utils import get_row_by_id
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.models import Task
from virtool.tasks.task import BaseTask

from sentry_sdk import capture_exception


class TaskRunner:
    def __init__(
        self, data: DataLayer, tasks_client: AbstractTasksClient, app: Application
    ):
        self._data = data
        self._tasks_client = tasks_client
        self.app = app

    async def run(self):
        task_id = None

        try:
            while True:
                logging.info("Waiting for next task")
                task_id = await self._tasks_client.pop()

                await self.run_task(task_id)

                await asyncio.shield(self.current_task)

                logging.info("Finished task: %s", task_id)

        except asyncio.CancelledError:
            if task_id is not None:
                logging.info("Recieved stop signal; awaiting task completion")

                try:
                    await asyncio.wait_for(asyncio.shield(self.current_task), 600)

                    logging.info("Finished task: %s", task_id)

                except asyncio.TimeoutError:
                    logging.info("Task %s timed out", task_id)

                except asyncio.CancelledError:
                    logging.info("Task %s was cancelled", task_id)

                except Exception as e:
                    pass

            logging.info("Task runner shutting down")

        except Exception as err:
            logging.fatal("Task runner shutting down due to exception %s", err)

            capture_exception(err)

    async def run_task(self, task_id: int):
        """
        Run task with given `task_id`.

        :param task_id: ID of the task

        """
        task: Task = await get_row_by_id(self.app["pg"], Task, task_id)

        logging.info(f"Starting task: %s %s", task.id, task.type)

        for cls in BaseTask.__subclasses__():
            if task.type == cls.name:
                current_task = await cls.from_task_id(self.app["data"], task.id)

                self.current_task = asyncio.get_event_loop().create_task(
                    current_task.run()
                )

                await asyncio.shield(self.current_task)
