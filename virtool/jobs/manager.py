import asyncio
import logging
import multiprocessing

import virtool.db.core
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.db
import virtool.samples.db
import virtool.db.utils
import virtool.dispatcher
import virtool.errors
import virtool.jobs.classes
import virtool.utils

TASK_LG = "lg"
TASK_SM = "sm"

TASK_SIZES = {
    "build_index": TASK_SM,
    "create_sample": TASK_SM,
    "create_subtraction": TASK_SM,
    "nuvs": TASK_LG,
    "pathoscope_bowtie": TASK_LG,
    "update_sample": TASK_SM
}


class IntegratedManager:
    """
    A job manager that can be integrated into a monolithic Virtool process.

    The integrated manager makes use of the shared application process and thread pool executors.

    """

    def __init__(self, app, capture_exception):
        #: A reference to the application dispatcher's :meth:`.dispatch` method.
        self._dispatch = app["dispatcher"].dispatch

        #: A :class:`multiprocess.Queue` used to receive dispatch information from job processes.
        self.queue = multiprocessing.Queue()

        #: The application database interface.
        self.dbi = app["db"]

        self.db_connection_string = app["settings"]["db_connection_string"]

        self.db_name = app["settings"]["db_name"]

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
                                    self.db_name,
                                    self.settings,
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

                await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            logging.debug("Cancelling running jobs")

            for job_id in self._jobs:
                job_process = self._jobs[job_id]["process"]

                if job_process.is_alive():
                    job_process.terminate()

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

    async def dispatch(self, interface, operation, id_list):

        if operation == "delete":
            await self._dispatch(interface, operation, id_list)

        collection = getattr(self.dbi, interface)

        projection = virtool.dispatcher.get_projection(interface)
        processor = virtool.dispatcher.get_processor(interface)

        async for document in collection.find({"_id": {"$in": id_list}}, projection=projection):
            await self._dispatch(interface, operation, processor(document))

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
                await virtool.jobs.db.cancel(self.dbi, job_id)
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


def get_task_limits(settings, task_name):
    size = TASK_SIZES[task_name]

    proc = settings[f"{size}_proc"]
    mem = settings[f"{size}_mem"]

    return proc, mem
