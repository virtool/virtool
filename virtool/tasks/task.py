import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.utils
import virtool.tasks.db
import virtool.tasks.pg
import virtool.utils

import virtool.tasks.models

logger = logging.getLogger("task")


class Task:

    def __init__(self, app, task_id):
        self.app = app
        self.db = app["db"]
        self.pg = app["postgres"]
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
        self.document = (await virtool.tasks.pg.get(self.pg, self.id)).to_dict()
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

    async def update_context(self, update):
        async with AsyncSession(self.pg) as session:
            result = await session.execute(select(virtool.tasks.models.Task).filter_by(id=self.id))
            task = result.scalar()
            for key, value in update.items():
                task.context[key] = value

            self.document = task.to_dict()
            self.context = self.document["context"]
            await session.commit()

        return self.context

    def get_tracker(self, total):
        factor = 1 / len(self.steps)
        initial = self.steps.index(self.step) * factor

        return ProgressTracker(
            self.db,
            self.id,
            total,
            factor=factor,
            increment=0.005,
            initial=initial
        )

    async def cleanup(self):
        pass

    async def error(self, error: str):
        async with AsyncSession(self.pg) as session:
            result = await session.execute(select(virtool.tasks.models.Task).filter_by(id=self.id))
            task = result.scalar()
            task.error = error
            await session.commit()

        await self.cleanup()

        logger.info(f"Task {self.id} encountered error '{error}'")


class ProgressTracker:

    def __init__(self, db, task_id, total, factor=1.0, increment=0.03, initial=0.0):
        self.db = db
        self.task_id = task_id
        self.total = total
        self.factor = factor
        self.increment = increment
        self.initial = initial

        self.count = 0
        self.last_reported = 0
        self.progress = self.initial

    async def add(self, value):
        count = self.count + value

        if count > self.total:
            raise ValueError("Count cannot exceed total")

        self.count = count

        self.progress = self.initial + round(self.count / self.total * self.factor, 2)

        if self.progress - self.last_reported >= self.increment:
            await virtool.tasks.db.update(
                self.db,
                self.task_id,
                count=self.count,
                progress=self.progress
            )

            self.last_reported = self.progress

        return self.progress
