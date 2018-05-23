import asyncio

import virtool.job
import virtool.utils
import virtool.job_classes


class Manager:

    def __init__(self, loop, executor, db, settings, dispatch, capture_exception):
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

        self.executor = executor

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
        while True:
            to_delete = list()

            available = get_available_resources(self.settings, self._jobs_dict)

            for job_id, job in self._jobs_dict.items():
                if not self._stop and not job.started:
                    if job.proc <= available["proc"] and job.mem <= available["mem"]:
                        job.start()
                        break

                if job.finished:
                    to_delete.append(job_id)

            for job_id in to_delete:
                del self._jobs_dict[job_id]

            await asyncio.sleep(0.1, loop=self.loop)

            if self._stop and len(self._jobs_dict) == 0:
                return

    async def new(self, task_name, task_args, user_id, job_id=None):

        job_id = job_id or await virtool.utils.get_new_id(self.db.jobs)

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

        self._jobs_dict[job_id] = virtool.job_classes.TASK_CLASSES[task_name](
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

        document = await self.db.jobs.find_one(job_id, virtool.job.LIST_PROJECTION)

        await self.dispatch("jobs", "update", virtool.job.processor(document))

        return virtool.utils.base_processor(document)

    async def cancel(self, job_id):
        await self._jobs_dict[job_id].cancel()

    async def close(self):
        self._stop = True

        for job in self._jobs_dict.values():
            await job.cancel()

        await self._run_task


def get_available_resources(settings, jobs):
    used = get_used_resources(jobs)
    return {key: settings[key] - used[key] for key in ["proc", "mem"]}


def get_used_resources(jobs):
    running_jobs = [j for j in jobs.values() if j.started]

    return {
        "proc": sum(j.proc for j in running_jobs),
        "mem": sum(j.mem for j in running_jobs)
    }



