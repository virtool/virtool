import asyncio
import logging

import virtool.tasks.task
from virtool.pg.utils import get_row_by_id
from virtool.tasks.models import Task


class TaskRunner:
    def __init__(self, channel, app):
        self._channel = channel
        self.app = app

    async def run(self):
        logging.info("Started task runner")

        try:
            while True:
                logging.info("Waiting for next task")
                await asyncio.sleep(0.3)

                task_id = await self._channel.get_json()

                await self.run_task(task_id)

                logging.info("Finished task: %s", task_id)

        except asyncio.CancelledError:
            logging.info("Stopped task runner")

    async def run_task(self, task_id: int):
        """
        Run task with given `task_id`.

        :param task_id: ID of the task

        """
        task: Task = await get_row_by_id(self.app["pg"], Task, task_id)

        logging.info(f"Starting task: %s %s", task.id, task.type)

        loop = asyncio.get_event_loop()

        for task_class in virtool.tasks.task.Task.__subclasses__():
            if task.type == task_class.task_type:
                current_task = task_class(self.app, task_id)
                await loop.create_task(current_task.run())
