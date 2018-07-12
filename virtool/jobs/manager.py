import asyncio
import logging

import virtool.db.jobs
import virtool.db.utils
import virtool.errors
import virtool.jobs.classes
import virtool.jobs.job
import virtool.utils


class Manager:

    def __init__(self, loop, executor, db, settings, capture_exception):
        #: The application IO loop
        self.loop = loop

        #: The application database client
        self.db = db

        #: The settings object
        self.settings = settings

        #: A reference to Sentry client's `captureException` method.
        self.capture_exception = capture_exception

        self.executor = executor

        #: A dict to store all the tracked job objects in.
        self._jobs_dict = dict()

    def __iter__(self):
        return iter(self._jobs_dict.keys())

    async def run(self):
        logging.debug("Started job manager")

        try:
            while True:
                to_delete = list()

                if len(self._jobs_dict):
                    available = get_available_resources(self.settings, self._jobs_dict)

                    for job_id, job in self._jobs_dict.items():
                        if not job.started:
                            if job.proc <= available["proc"] and job.mem <= available["mem"]:
                                job.start()
                                break

                        if job.finished:
                            to_delete.append(job.id)

                for job_id in to_delete:
                    del self._jobs_dict[job_id]

                await asyncio.sleep(0.1, loop=self.loop)

        except asyncio.CancelledError:
            logging.debug("Cancelling running jobs")

            for job in self._jobs_dict.values():
                await job.cancel()

        logging.debug("Closed job manager")

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
            self.capture_exception,
            job_id,
            task_name,
            task_args,
            proc,
            mem
        )

        document = await self.db.jobs.find_one(job_id, virtool.db.jobs.PROJECTION)

        return virtool.utils.base_processor(document)

    async def cancel(self, job_id):
        await self._jobs_dict[job_id].cancel()


def get_available_resources(settings, jobs):
    used = get_used_resources(jobs)
    return {key: settings[key] - used[key] for key in ["proc", "mem"]}


def get_used_resources(jobs):
    running_jobs = [j for j in jobs.values() if j.started]

    return {
        "proc": sum(j.proc for j in running_jobs),
        "mem": sum(j.mem for j in running_jobs)
    }
