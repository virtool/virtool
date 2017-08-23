import sys
import pymongo
import traceback

import virtool.utils


LIST_PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "user"
]


def dispatch_processor(document):
    """
    Removes the ``status`` and ``args`` fields from the job document.
    Adds a ``username`` field, an ``added`` date taken from the first status entry in the job document, and
    ``state`` and ``progress`` fields taken from the most recent status entry in the job document.
    :param document: a document to process.
    :type document: dict

    :return: a processed documents.
    :rtype: dict
    """
    document = virtool.utils.base_processor(document)

    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "state": last_update["state"],
        "stage": last_update["stage"],
        "created_at": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return document


class Job:

    def __init__(self, loop, executor, db, settings, dispatch, job_id, task_name, task_args, proc, mem):
        self.loop = loop
        self.executor = executor
        self.db = db
        self.settings = settings
        self.dispatch = dispatch
        self.id = job_id
        self.task_name = task_name
        self.task_args = task_args
        self.proc = proc
        self.mem = mem

        self.started = False
        self.finished = False

        self._progress = 0
        self._state = "waiting"
        self._stage = None
        self._error = None
        self._task = None
        self._process_task = None
        self._stage_list = None

    def start(self):
        self._task = self.loop.create_task(self.run())
        self.started = True

    async def run(self):
        for method in self._stage_list:
            await self.add_status(stage=method.__name__, state="running")

            try:
                await method()
            except:
                self._error = handle_exception()

            if self._error:
                break

        self._progress = 1
        self.finished = True

        if self._error:
            await self.add_status(state="error")
        else:
            await self.add_status(state="complete")

    async def run_in_executor(self, func, *args):
        self._process_task = self.loop.run_in_executor(self.executor, func, *args)
        return await self._process_task

    async def add_status(self, state=None, stage=None):
        self._state = state or self._state
        self._stage = stage or self._stage

        if self.finished:
            self._progress = 1
        else:
            stage_index = [m.__name__ for m in self._stage_list].index(self._stage)
            self._progress = round((stage_index + 1) / (len(self._stage_list) + 1), 2)

        document = await self.db.jobs.find_one_and_update({"_id": self.id}, {
            "$push": {
                "status": {
                    "state": self._state,
                    "stage": self._stage,
                    "error": self._error,
                    "progress": self._progress,
                    "timestamp": virtool.utils.timestamp()
                }
            }
        }, return_document=pymongo.ReturnDocument.AFTER, projection=LIST_PROJECTION)

        await self.dispatch("jobs", "update", dispatch_processor(document))

    async def cancel(self):
        if self.started:
            return await self._task.cancel()

        await self.cleanup()

        self.finished = True

    async def cleanup(self):
        pass


def stage_method(func):
    func.is_stage_method = True
    return func


def handle_exception(max_tb=50):
    exception, value, trace_info = sys.exc_info()

    return {
        "type": exception.__name__,
        "traceback": traceback.format_tb(trace_info, max_tb),
        "details": [str(l) for l in value.args]
    }
