import aiojobs.aiohttp
import asyncio
import logging
import multiprocessing

import virtool.db.iface
import virtool.db.jobs
import virtool.db.utils
import virtool.errors
import virtool.jobs.classes
import virtool.jobs.job
import virtool.utils


class IntegratedManager:
    """
    A job manager that can be integrated into a monolithic Virtool process.

    The integrated manager makes use of the shared application process and thread pool executors.

    """
    def __init__(self, app, capture_exception):

        self.dispatch = app["dispatcher"].dispatch

        self.queue = multiprocessing.Queue()

        self.scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

        #: The application IO loop
        self.loop = app.loop

        #: The application database interface.
        self.dbi = app["db"]

        self.db_connection_string = app["db_connection_string"]

        self.process_executor = app["process_executor"]

        #: The settings dict.
        self.settings = app["settings"]

        #: A reference to Sentry client's `captureException` method.
        self.capture_exception = capture_exception

        #: A dict to store all the tracked job objects in.
        self._jobs = dict()

    async def run(self):
        logging.debug("Started job manager")

        try:
            while True:
                to_delete = list()

                if len(self._jobs):
                    available = get_available_resources(self.settings, self._jobs)

                    for job_id, job in self._jobs.items():
                        if not job["process"]:
                            if job["proc"] <= available["proc"] and job["mem"] <= available["mem"]:
                                job["process"] = job["class"](
                                    self.db_connection_string,
                                    self.settings.as_dict(),
                                    job_id,
                                    self.queue
                                )

                                job["process"].start()

                                break

                        elif not job["process"].is_alive():
                            to_delete.append(job_id)

                for job_id in to_delete:
                    del self._jobs[job_id]

                if not self.queue.empty():
                    msg = self.queue.get()
                    await self.dispatch(*msg)

                await asyncio.sleep(0.1, loop=self.loop)

        except asyncio.CancelledError:
            logging.debug("Cancelling running jobs")

            for job_id in self._jobs:
                self._jobs[job_id]["process"].terminate()

        logging.debug("Closed job manager")

    async def enqueue(self, job_id):
        document = await self.dbi.jobs.find_one(job_id, ["task", "args", "proc", "mem"])

        task_name = document["task"]

        self._jobs[job_id] = {
            "process": None,
            "class": virtool.jobs.classes.TASK_CLASSES[task_name],
            "task_name": task_name,
            "task_args": document["args"],
            "proc": document["proc"],
            "mem": document["mem"]
        }

    async def cancel(self, job_id):
        """
        Cancel the job with the given `job_id` if it is in the `_jobs_dict`.

        :param job_id: the id of the job to cancel
        :type job_id: str

        """
        job = self._jobs.get(job_id, None)

        if job:
            if job["process"] and job["process"].is_alive():
                job["process"].terminate()
            else:
                del self._jobs[job_id]


def get_available_resources(settings, jobs):
    used = get_used_resources(jobs)
    return {key: settings[key] - used[key] for key in ["proc", "mem"]}


def get_used_resources(jobs):
    running_jobs = [j for j in jobs.values() if j["process"]]

    return {
        "proc": sum(j["proc"] for j in running_jobs),
        "mem": sum(j["mem"] for j in running_jobs)
    }
