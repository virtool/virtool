import logging

import virtool.db.utils
import virtool.tasks.db
import virtool.utils

logger = logging.getLogger("task")


class Task:

    def __init__(self, app, task_id):
        self.app = app
        self.db = app["db"]
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
        self.document = await self.db.tasks.find_one(self.id, {"_id": False})
        self.context = self.document["context"]

    async def run(self):
        await self.init_db()

        for func in self.steps:
            if self.errored:
                break

            self.step = func

            await virtool.tasks.db.update(
                self.db,
                self.id,
                step=self.step.__name__
            )

            await func()

        if not self.errored:
            await virtool.tasks.db.complete(self.db, self.id)
            self.temp_dir.cleanup()

    async def update_context(self, update):
        with_prefix = {f"context.{key}": value for key, value in update.items()}

        document = await self.db.tasks.find_one_and_update({"_id": self.id}, {
            "$set": with_prefix
        })

        self.document = document
        self.context = document["context"]

        return self.context

    def get_tracker(self, total):
        factor = round(100 / len(self.steps))
        initial = self.steps.index(self.step) * factor

        return ProgressTracker(
            self.db,
            self.id,
            total,
            factor=factor,
            increment=5,
            initial=initial
        )

    async def cleanup(self):
        pass

    async def error(self, errors: list):
        await virtool.tasks.db.update(
            self.db,
            self.id,
            errors=errors
        )

        await self.cleanup()

        for error in errors:
            logger.info(f"Task {id} encountered error '{error}'")


class ProgressTracker:

    def __init__(self, db, task_id, total, factor=100, increment=3, initial=0):
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

        self.progress = self.initial + round(self.count / self.total * self.factor)

        if self.progress - self.last_reported >= self.increment:
            await virtool.tasks.db.update(
                self.db,
                self.task_id,
                count=self.count,
                progress=self.progress
            )

            self.last_reported = self.progress

        return self.progress
