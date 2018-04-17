import asyncio
from concurrent.futures import ProcessPoolExecutor

import virtool.db.jobs
import virtool.db.utils
import virtool.errors
import virtool.jobs.classes
import virtool.jobs.job
import virtool.utils


class Manager:

    def __init__(self, loop, db, settings, dispatch, capture_exception):
        #: The application IO loop
        self.loop = loop

        #: The application database client
        self.db = db

        #: The settings object
        self.settings = settings

        #: A reference to the dispatcher's dispatch method.
        self.dispatch = dispatch

        #: A reference to Sentry client's `captureException` method.
        self.capture_exception = capture_exception

        self._used = {
            "proc": 0,
            "mem": 0
        }

        self.executor = ProcessPoolExecutor()

        #: A dict to store all the tracked job objects in.
        self._jobs_dict = dict()

        self._run_task = None

        #: The main loop
        self._stop = False
        self.started = False

    def __iter__(self):
        return iter(self._jobs_dict.keys())

    def start(self):
        self.started = True
        self._run_task = asyncio.ensure_future(self.run(), loop=self.loop)

    async def run(self):
        iteration = 0

        while True:
            to_delete = list()

            for job in self._jobs_dict.values():
                if not self._stop and not job.started:
                    try:
                        self.reserve_resources(job)
                        job.start()
                    except virtool.errors.InsufficientResourceError:
                        pass

                if job.finished:
                    self.release_resources(job)
                    to_delete.append(job.id)

            for job_id in to_delete:
                del self._jobs_dict[job_id]

            iteration += 1

            if iteration == 100:
                iteration = 0

                ids = await virtool.db.jobs.get_waiting_and_running_ids(self.db)

                await self.db.jobs.delete_many({
                    "_id": {
                        "$in": [job_id for job_id in ids if job_id not in self._jobs_dict]
                    }
                })

            await asyncio.sleep(0.1, loop=self.loop)

            if self._stop and len(self._jobs_dict) == 0:
                break

    async def new(self, task_name, task_args, user_id, job_id=None):

        job_id = job_id or await virtool.db.utils.get_new_id(self.db.jobs)

        proc = self.settings.get("{}_proc".format(task_name))
        mem = self.settings.get("{}_mem".format(task_name))

        await self.db.jobs.insert_one({
            "_id": job_id,
            "task": task_name,
            "args": task_args,
            "proc": proc,
            "mem": mem,
            "user": {
                "id": user_id
            },
            "status": [
                {
                    "state": "waiting",
                    "stage": None,
                    "error": None,
                    "progress": 0,
                    "timestamp": virtool.utils.timestamp()
                }
            ]
        })

        self._jobs_dict[job_id] = virtool.jobs.classes.TASK_CLASSES[task_name](
            self.loop,
            self.executor,
            self.db,
            self.settings,
            self.dispatch,
            self.capture_exception,
            job_id,
            task_name,
            task_args,
            proc,
            mem
        )

        document = await self.db.jobs.find_one(job_id, virtool.db.jobs.LIST_PROJECTION)

        await self.dispatch("jobs", "update", virtool.db.jobs.processor(document))

        return virtool.utils.base_processor(document)

    async def cancel(self, job_id):
        await self._jobs_dict[job_id].cancel()

    async def close(self):
        self._stop = True

        for job in self._jobs_dict.values():
            await job.cancel()

        self.executor.shutdown(wait=True)

    def reserve_resources(self, job):
        """
        Reserve resources for the given job. Throws an :class:`InsufficientResourceError` if the required resources are
        not available.

        :param job: the job object to reserve resources for
        :type job: :class:`virtool.job.Job`

        :raises: :class:`InsufficientResourceError`

        """
        available = self.get_resources()["available"]

        if job.proc <= available["proc"] and job.mem <= available["mem"]:
            self._used["proc"] += job.proc
            self._used["mem"] += job.mem
        else:
            raise virtool.errors.InsufficientResourceError

    def release_resources(self, job):
        self._used["proc"] -= job.proc
        self._used["mem"] -= job.mem

    def get_resources(self):
        return {
            "used": dict(self._used),
            "available": {key: self.settings.get(key) - self._used[key] for key in self._used},
            "limit": {key: self.settings.get(key) for key in self._used}
        }
