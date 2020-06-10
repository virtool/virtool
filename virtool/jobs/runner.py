import asyncio
import logging

import virtool.db.core
import virtool.db.utils
import virtool.errors
import virtool.indexes.db
import virtool.jobs.classes
import virtool.jobs.db
import virtool.jobs.job
import virtool.jobs.utils
import virtool.otus.db
import virtool.redis
import virtool.samples.db
import virtool.utils

logger = logging.getLogger(__name__)


class Base:

    def __init__(self, app, capture_exception):
        self.db = app["db"]
        self.redis = app["redis"]
        self.settings = app["settings"]

    async def _get_job_from_list(self, key):
        job_id = await self.redis.lpop(key, encoding="utf-8")

        if job_id:
            logger.debug(f"Pulled job '{job_id}' from Redis list '{key}'")

        return job_id


class JobRunner(Base):

    async def run(self):
        logging.debug("Started job runner")

        try:
            while True:
                logging.info("Waiting for next job")
                job_id = await self._get_job_from_lists()

                document = await self.db.jobs.find_one(job_id, ["task", "state"])

                if document is None:
                    logging.debug(f"Job document not found: {job_id}")
                    continue

                if document["state"] != "waiting":
                    logging.debug(f"Job is already running: {job_id}")

                job_obj = virtool.jobs.classes.TASK_CREATORS[document["task"]]()

                logging.info(f"Job starting: {job_id}")

                await job_obj.run(
                    self.db,
                    self.redis,
                    self.settings,
                    job_id
                )

                logging.info(f"Job finished: {job_id}")

        except asyncio.CancelledError:
            logging.info("Stopped runner")

    async def _get_job_from_lists(self):
        while True:
            for key in self.settings["job_list"]:
                job_id = await self._get_job_from_list(key)

                if job_id:
                    return job_id

            await asyncio.sleep(0.3)

    async def _run_job(self):
        pass


class JobAgent(Base):

    def __init__(self, app, capture_exception):
        super().__init__(app, capture_exception)

        #: A dict to store all running job objects in.
        self._jobs = dict()

    async def run(self):
        logging.debug("Started job agent")

        try:
            while True:
                next_jobs = dict()

                for job_id, job in self._jobs.items():
                    if job["process"].returncode is None:
                        next_jobs[job_id] = job
                    else:
                        logger.info(f"Job finished: {job_id}")

                self._jobs = next_jobs

                available = get_available_resources(self.settings, self._jobs)

                if available["proc"] >= self.settings["lg_proc"] and available["mem"] >= self.settings["lg_mem"]:
                    job_id = await self._get_job_from_list("jobs_lg")

                    if job_id:
                        logger.info(f"Found job: {job_id}")
                        await self._start_job(job_id)
                        continue

                if available["proc"] >= self.settings["sm_proc"] and available["mem"] >= self.settings["sm_mem"]:
                    job_id = await self._get_job_from_list("jobs_sm")

                    if job_id:
                        logger.info(f"Found job: {job_id}")
                        await self._start_job(job_id)
                        continue

                await asyncio.sleep(0.3)

        except asyncio.CancelledError:
            logging.info("Stopped runner")

    async def _start_job(self, job_id):
        document = await self.db.jobs.find_one(job_id, ["task", "mem", "proc", "state"])

        if document is None or document["state"] != "waiting":
            return None

        task = document["task"]

        proc, mem = get_task_limits(self.settings, task)

        await self.db.jobs.update_one({"_id": job_id}, {
            "$set": {
                "proc": proc,
                "mem": mem
            }
        })

        command = [
            "python",
            "run.py",
            "job",
            "--db-connection-string", self.settings["db_connection_string"],
            "--db-name", self.settings["db_name"],
            "--redis-connection-string", self.settings["redis_connection_string"],
            "--job-id", job_id,
            "--proc", str(proc),
            "--mem", str(mem)
        ]

        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.STDOUT
        )

        self._jobs[job_id] = {
            "process": process,
            "proc": proc,
            "mem": mem
        }

        logger.info(f"Started job {job_id} with pid {process.pid}")


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
    size = virtool.jobs.utils.TASK_SIZES[task_name]

    proc = settings[f"{size}_proc"]
    mem = settings[f"{size}_mem"]

    return proc, mem
