import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.tasks.models import Task
from virtool.tasks.classes import TASK_CLASSES


class TaskRunner:
    def __init__(self, app):
        self.q = asyncio.Queue()
        self.app = app

    async def run(self):
        logging.info("Started task runner")

        try:
            while True:
                logging.info("Waiting for next task")
                await asyncio.sleep(0.3)
                task_id = await self.q.get()

                logging.info(f"Task starting: {task_id}")

                await self.run_task(task_id)

                self.q.task_done()
                logging.info(f"Task finished: {task_id}")

        except asyncio.CancelledError:
            logging.info("Stopped task runner")

    async def run_task(self, task_id: int):
        """
        Run task with given `task_id`.

        :param task_id: ID of the task

        """
        async with AsyncSession(self.app["pg"]) as session:
            result = await session.execute(select(Task).filter_by(id=task_id))
            document = result.scalar().to_dict()

        loop = asyncio.get_event_loop()
        task_class = TASK_CLASSES[document["type"]](self.app, task_id)
        task = loop.create_task(task_class.run())

        await task
