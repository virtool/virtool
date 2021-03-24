import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.utils
import virtool.tasks.pg
import virtool.utils

import virtool.tasks.models

logger = logging.getLogger("task")


class Task:

    task_type = None

    def __init__(self, app, task_id):
        self.app = app
        self.db = app["db"]
        self.pg = app["pg"]
        self.run_in_thread = app["run_in_thread"]
        self.id = task_id
        self.step = None
        self.steps = []
        self.intermediate = dict()
        self.document = None
        self.context = None
        self.errored = False
        self.temp_dir = virtool.utils.get_temp_dir()

    async def init_db(self):
        self.document = await virtool.tasks.pg.get(self.pg, self.id)
        self.context = self.document["context"]

    async def run(self):
        await self.init_db()

        for func in self.steps:
            if self.errored:
                break

            self.step = func

            await virtool.tasks.pg.update(
                self.pg,
                self.id,
                step=self.step.__name__
            )

            await func()

        if not self.errored:
            await virtool.tasks.pg.complete(self.pg, self.id)
            self.temp_dir.cleanup()

    async def update_context(self, update: dict) -> dict:
        """
        Update the context field of the current task in SQL database.

        :param update: d dict of data need to be updated
        :return: the context field after updating

        """
        async with AsyncSession(self.pg) as session:
            result = await session.execute(select(virtool.tasks.models.Task).filter_by(id=self.id))
            task = result.scalar()
            for key, value in update.items():
                task.context[key] = value

            self.document = task.to_dict()
            self.context = self.document["context"]
            await session.commit()

        return self.context

    async def get_tracker(self, file_size: int = 0):
        """
        Get a :class:``ProgressTracker`` for current step.

        :param file_size: the size of a file that is processing in current step
        :return: a :class:``ProgressTracker``

        """
        async with AsyncSession(self.pg) as session:
            result = await session.execute(select(virtool.tasks.models.Task).filter_by(id=self.id))
            task = result.scalar().to_dict()
            initial = task["progress"]

        total = round((100 - initial) / (len(self.steps) - self.steps.index(self.step)))

        return ProgressTracker(
            self.pg,
            self.id,
            total,
            file_size=file_size,
            initial=initial
        )

    async def cleanup(self):
        pass

    async def error(self, error: str):
        """
        Update the error field of the current task in SQL database
        and execute a cleanup step.

        :param error: the error message

        """
        async with AsyncSession(self.pg) as session:
            result = await session.execute(select(virtool.tasks.models.Task).filter_by(id=self.id))
            task = result.scalar()
            task.error = error
            await session.commit()

        await self.cleanup()

        logger.info(f"Task {self.id} encountered error '{error}'")


class ProgressTracker:

    def __init__(self, pg, task_id, total, initial=0.0, file_size=0):
        self.pg = pg
        self.task_id = task_id
        self.total = total
        self.initial = initial
        self.file_size = file_size

        self.progress = self.initial
        self.step_completed = self.initial + self.total

    async def add(self, value: int) -> int:
        """
        Add value to progress, the value will be automatically convert to progress based on the value and file size,
        and update to the SQL database.

        :param value: the value to be added to progress.
        :return: the new progress after update.

        """
        self.progress += (value / self.file_size) * self.total

        async with AsyncSession(self.pg) as session:
            result = await session.execute(select(virtool.tasks.models.Task).filter_by(id=self.task_id))
            task = result.scalar()
            task.progress = round(self.progress)
            await session.commit()

        return round(self.progress)
