import asyncio
import logging
import inspect
import collections
import multiprocessing

from pymongo import ReturnDocument
from operator import itemgetter

import virtool.job
import virtool.job_classes
import virtool.utils
import virtool.errors
import virtool.virus_index

logger = logging.getLogger(__name__)


class Manager:
    """
    Provides functionality for managing active jobs and manipulating and reading the job documents in the MongoDB
    collection. This object is referred to as the **job manager** in this documentation.

    The job manager controls which jobs are running based on the job resource settings. Jobs that are running or are
    waiting for resources to become available are represented by instances of the :class:`~.job.Job` subclasses
    described in :data:`.TASK_CLASSES`. The job manager can create new active jobs and cancel existing active jobs. It

    Exposed methods allow clients to cancel and remove jobs. Internal methods also are provided for starting
    new jobs and interacting with separate job processes.

    """
    def __init__(self, db, settings, dispatch):
        self.db = db
        self.settings = settings
        self.dispatch = dispatch

        #: A :class:`dict` containing dicts describing each running or waiting job.
        self.jobs_dict = {}

        #: Jobs are blocked from starting when this is ``True``. This cannot be canonically changed without
        #: reinitializing the job manager.
        self.blocked = False

        #: A :class:`dict` used for keeping track of used system resources.
        self.used = {
            "proc": 0,
            "mem": 0
        }

        #: A :class:`dict` for keeping track of the number or running jobs for each task type.
        self.task_counts = {key: 0 for key in TASK_CLASSES}

        #: A :class:`multiprocessing.Queue` object used to communicate with job processes.
        self.message_queue = multiprocessing.Queue()

    def iterate(self):
        """
        The central runtime method for the collection. When called, it:

        1. Checks for database operations sent from :class:`~.job.Job` objects via :attr:`queue` and performs
           them.

        2. Iterates through all jobs in :attr:`.jobs_dict` and starts waiting jobs for which resources are available and
           removes jobs that have been terminated.

        """
        while not self.message_queue.empty():
            message = self.message_queue.get()
            data = message["data"]

            if message["operation"] == "update_status":
                if data["error"]:
                    self.jobs_dict[data["_id"]]["obj"].terminate()

                self.update_status(
                    data["_id"],
                    data["progress"],
                    data["state"],
                    data["stage"],
                    data["error"]
                )

            else:
                method = getattr(self.collections[message["collection_name"]], message["operation"])

                try:
                    yield method(message["data"])
                except TypeError:
                    yield method()

        for job_id in list(self.jobs_dict.keys()):
            # Get job data.
            job_dict = self.jobs_dict[job_id]
            task = job_dict["task"]

            # Get the number of running jobs with the same task.
            task_count = self.task_counts[task]

            # Check if resources are available to run a waiting job
            if not self.blocked and not job_dict["started"]:
                task_limit = self.settings.get(task + "_inst")

                if self.resources_available(job_dict["proc"], job_dict["mem"]) and task_count < task_limit:
                    # Reserve resources and task slots
                    for key in self.used:
                        self.used[key] += job_dict[key]

                    self.task_counts[task] += 1

                    # Start job
                    job_dict["started"] = True
                    job_dict["obj"].start()

            if job_dict["started"] and not job_dict["obj"].is_alive():
                # Join the job process.
                job_dict["obj"].join()

                # Release the resources reserved for the job.
                self.release_resources(job_id)

                # Add the job to a list of job_ids that should be removed
                del self.jobs_dict[job_id]

    async def resume(self):
        """
        Resume preserved waiting jobs. This is be called immediately after the Manager has been instantiated.
         
        """
        async for document in self.db.jobs.find({"status.1": {"$exists": False}}):
            job_id, task, proc, mem = itemgetter("job_id", "task", "proc", "mem")(document)

            # Instantiate a new job object.
            job = TASK_CLASSES[task](
                job_id,
                self.settings.to_read_only(),
                self.message_queue,
                task,
                document["args"],
                proc,
                mem
            )

            # Add a dict describing the new job to jobs_dict.
            self.jobs_dict[job_id] = {
                "obj": job,
                "task": task,
                "started": False,
                "proc": proc,
                "mem": mem
            }

    async def new(self, task, task_args, proc, mem, username, job_id=None):
        """
        Start a new job. Inserts a new job document into the database, instantiates a new :class:`.Job` object, and
        creates a new job dict in :attr:`.jobs_dict`. New jobs are in the waiting state.

        :param task: the name of the task to spawn.
        :type task: str

        :param task_args: arguments to be passed to the new :class:`~.job.Job` object.
        :type task_args: dict

        :param proc: the number of processor cores to reserve for the job.
        :type proc: int

        :param mem: the number of GBs of memory to reserve for the job.
        :type mem: int

        :param username: the name of the user that started the job.
        :type username: str

        :param job_id: optionally provide a job id--one will be automatically generated otherwise.
        :type job_id: str or None

        :return: the response from the Mongo insert operation.
        :rtype: dict

        """
        # Generate a new random job id.
        job_id = job_id or await get_new_id(self.db.jobs)

        # Insert a document in the database describing the new job.
        await self.db.jobs.insert_one({
            "_id": job_id,
            "task": task,
            "args": task_args,
            "proc": proc,
            "mem": mem,
            "username": username,
            "status": [{
                "state": "waiting",
                "stage": None,
                "error": None,
                "progress": 0,
                "date": virtool.utils.timestamp()
            }]
        })

        # Instantiate a new job object.
        job = TASK_CLASSES[task](
            job_id,
            self.settings.to_read_only(),
            self.message_queue,
            task,
            task_args,
            proc,
            mem
        )

        # Add a dict describing the new job to jobs_dict.
        self.jobs_dict[job_id] = {
            "obj": job,
            "task": task,
            "started": False,
            "proc": proc,
            "mem": mem
        }

        document = await self.db.jobs.find_one(job_id, dispatch_projection)

        self.dispatch("jobs", "update", document)

        return dispatch_processor(document)

    async def cancel(self, job_id):
        """
        Cancel the jobs with the ids in ``id_list``.

        If a job is waiting to run, it is removed from the :attr:`.jobs_dict` and the job object's
        :meth:`~.Job.cleanup` method is called. A *cancelled* status entry is added to the job document by calling
        :meth:`.update_status`.

        If the job is running, the job object's :meth:`~.Job.terminate` method is called. The job object handles the
        SIGTERM and takes care of calling :meth:`~.Job.cleanup` and :meth:`.update_status`.

        :param job_id: the id for the job to cancel
        :type job_id: str

        """
        job_dict = self.jobs_dict[job_id]

        if job_dict["started"]:
            job_dict["obj"].terminate()

        # Just delete the job if it still waiting to be started
        else:
            await self.update_status(job_id, 0, "cancelled", None)

            job_dict["obj"].cleanup()

            # self._to_remove.append(_id)
            self.jobs_dict.pop(job_id)

    async def update_status(self, job_id, progress, state, stage, error=None):
        """
        Push a new entry to the ``status`` field for the document identified by the passed ``job_id``.

        :param job_id: the id of the job to update the status for.
        :type job_id: str

        :param progress: the progress of the job (0 - 1).
        :type progress: float

        :param state: the state of the job.
        :type state: str

        :param stage: the stage the job has reached.
        :type stage: str or None

        :param error: an error dict if an error has occurred.
        :type error: dict or None

        """

        document = await self.db.jobs.find_one_and_update({"_id": job_id}, {
            "$push": {
                "status": {
                    "state": state,
                    "stage": stage,
                    "progress": progress,
                    "date": virtool.utils.timestamp(),
                    "error": error
                }
            }
        }, return_document=ReturnDocument.AFTER, projection=dispatch_projection)

        self.dispatch("jobs", "update", dispatch_processor(document))

    def release_resources(self, job_id):
        """
        Releases resources consumed by the job identified by the passed ``job_id``.

        :param job_id: the id of the job to release resources for.
        :type job_id: str

        """
        # Get the dict for the job.
        job = self.jobs_dict[job_id]

        # Reduce the used resource counts by the amounts reserved for the job.
        for key in ["proc", "mem"]:
            self.used[key] -= job[key]

        # Decrement the global task count for the job task by one.
        self.task_counts[job["task"]] -= 1

    def resources_available(self, proc=0, mem=0):
        """
        Check if the given number proc and amount of memory are available.

        :param proc: the number of processor cores.
        :type proc: int

        :param mem: the number of GBs of memory.
        :type mem: int

        :return: boolean indicating whether the resources are available or not.
        :rtype: bool

        """
        return proc <= self.resources["available"]["proc"] and mem <= self.resources["available"]["mem"]

    def resources(self):
        """
        A method decorated by :class:`property` and exposed as an instance attribute that returns a dictionary of
        available and used resources as well as the global limits.

        """
        return {
            "used": dict(self.used.items()),
            "available": {key: self.settings.get(key) - self.used[key] for key in self.used},
            "limit": {key: self.settings.get(key) for key in self.used}
        }
