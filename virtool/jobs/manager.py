import asyncio
import logging
import motor.motor_asyncio

import virtool.db.iface
import virtool.db.jobs
import virtool.db.utils
import virtool.errors
import virtool.jobs.classes
import virtool.jobs.job
import virtool.utils


class BaseManager:

    def __init__(self, loop, dbi, settings, capture_exception):

        #: The application IO loop
        self.loop = loop

        #: The application database client
        self.dbi = dbi

        #: The settings object
        self.settings = settings

        #: A reference to Sentry client's `captureException` method.
        self.capture_exception = capture_exception

        #: A dict to store all the tracked job objects in.
        self._jobs = dict()


class DedicatedClient:

    def __init__(self, dbi, messaging):
        self.dbi = dbi
        self.messaging = messaging

    def enqueue(self, job_id):
        self.messaging.add(job_id)

    def cancel(self, job_id):
        pass


class DedicatedManager:
    """
    A job manager that can run as a dedicated process and communicate with Virtool API servers over the network.

    """
    def __init__(self, loop, db_connection_string, settings):

        dbi = virtool.db.iface.DB(
            motor.motor_asyncio.AsyncIOMotorClient(db_connection_string),
            self.dispatch,
            loop
        )

        super().__init__(loop, dbi, settings, self.capture_exception)

    def capture_exception(self):
        print("Captured exception")

    def dispatch(self):
        """
        Will pass a message to the dispatcher.

        """
        pass


class IntegratedManager(BaseManager):
    """
    A job manager that can be integrated into a monolithic Virtool process.

    The integrated manager makes use of the shared application process and thread pool executors.

    """
    def __init__(self, loop, dbi, settings, capture_exception):
        super().__init__(loop, dbi, settings, capture_exception)

        #: The application IO loop
        self.loop = loop

        #: The application database interface.
        self.dbi = dbi

        #: The settings dict.
        self.settings = settings

        #: A reference to Sentry client's `captureException` method.
        self.capture_exception = capture_exception

    async def run(self):
        logging.debug("Started job manager")

        try:
            while True:
                to_delete = list()

                if len(self._jobs):
                    available = get_available_resources(self.settings, self._jobs)

                    for job_id, job in self._jobs.items():
                        if not job.started:
                            if job.proc <= available["proc"] and job.mem <= available["mem"]:
                                job.start()
                                break

                        if job.finished:
                            to_delete.append(job.id)

                for job_id in to_delete:
                    del self._jobs[job_id]

                await asyncio.sleep(0.1, loop=self.loop)

        except asyncio.CancelledError:
            logging.debug("Cancelling running jobs")

            for job in self._jobs.values():
                await job.cancel()

        logging.debug("Closed job manager")

    async def enqueue(self, job_id):
        document = await self.dbi.jobs.find_one(job_id)

        task_name = document["task_name"]
        task_args = document["task_args"]

        self._jobs[job_id] = virtool.jobs.classes.TASK_CLASSES[task_name](
            self.loop,
            self.settings,
            self.capture_exception,
            job_id,
            task_name,
            task_args
        )

    async def cancel(self, job_id):
        """
        Cancel the job with the given `job_id` if it is in the `_jobs_dict`.

        :param job_id: the id of the job to cancel
        :type job_id: str

        """
        job = self._jobs.get(job_id, None)

        if job:
            await job.cancel()


def get_available_resources(settings, jobs):
    used = get_used_resources(jobs)
    return {key: settings[key] - used[key] for key in ["proc", "mem"]}


def get_used_resources(jobs):
    running_jobs = [j for j in jobs.values() if j.started]

    return {
        "proc": sum(j.proc for j in running_jobs),
        "mem": sum(j.mem for j in running_jobs)
    }
