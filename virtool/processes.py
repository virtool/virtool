import virtool.db.processes
import virtool.db.utils

FIRST_STEPS = {
    "delete_reference": "delete_indexes",
    "clone_reference": "copy_otus",
    "import_reference": "load_file",
    "remote_reference": "download",
    "update_remote_reference": "download",
    "update_software": "download",
    "install_hmms": "download"
}


class Process:

    def __init__(self, app, process_id):
        self.app = app
        self.db = app["db"]
        self.run_in_thread = app["run_in_thread"]
        self.id = process_id
        self.step = None
        self.steps = []
        self.document = None
        self.context = None
        self.errored = False

    async def init_db(self):
        self.document = await self.db.processes.find_one(self.id, {"_id": False})
        self.context = self.document["context"]

    async def run(self):
        await self.init_db()

        for i, func in enumerate(self.steps):
            self.step = func

            await virtool.db.processes.update(
                self.db,
                self.id,
                step=self.step.__name__
            )

            await func()

        await virtool.db.processes.complete(self.db, self.id)

    async def update_context(self, update):
        with_prefix = {f"context.{key}": value for key, value in update.items()}

        document = await self.db.processes.find_one_and_update({"_id": self.id}, {
            "$set": with_prefix
        })

        self.document = document
        self.context = document["context"]

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

    def cleanup(self):
        pass

    def error(self, message):
        self.cleanup()


class ProgressTracker:

    def __init__(self, db, process_id, total, factor=1.0, increment=0.03, initial=0.0):
        self.db = db
        self.process_id = process_id
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
            await virtool.db.processes.update(
                self.db,
                self.process_id,
                count=self.count,
                progress=self.progress
            )

            self.last_reported = self.progress

        return self.progress
