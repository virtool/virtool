import asyncio
import logging

import virtool.db.core
import virtool.db.utils
import virtool.dispatcher
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


class DistributedJobAgent:

    def __init__(self, app, capture_exception):
        self.db = app["db"]
        self.redis = app["redis"]
        self.settings = app["settings"]

        self.cancel_channel = None
        self.dispatch_channel = None

        #: A dict to store all running job objects in.
        self._jobs = dict()

        self.dispatch = virtool.redis.create_dispatch(self.redis)

    async def run(self):
        logging.debug("Started distributed job manager")
        self.cancel_channel, = await self.redis.subscribe("channel:cancel")

        await asyncio.wait([
            self._check_cancel(),
            self._run_manager()
        ])

    async def _run_manager(self):
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
                    job_id = await self._get_lg_job()

                    if job_id:
                        logger.info(f"Found job: {job_id}")
                        await self._start_job(job_id)
                        continue

                if available["proc"] >= self.settings["sm_proc"] and available["mem"] >= self.settings["sm_mem"]:
                    job_id = await self._get_sm_job()

                    if job_id:
                        logger.info(f"Found job: {job_id}")
                        await self._start_job(job_id)
                        continue

                await asyncio.sleep(0.3)

        except asyncio.CancelledError:
            logging.debug("Stopping job runner")

        logging.debug("Stopped job runner")

    async def _cancel(self, job_id):
        logger.info(f"Cancelling job: {job_id}")

        self._process = job = self._jobs.get(job_id)

        if job:
            if job["process"] and job["process"].is_alive():
                job["process"].terminate()
            else:
                await virtool.jobs.db.cancel(self.db, job_id)
                del self._jobs[job_id]
                await self.dispatch(
                    "jobs",
                    "update",
                    [job_id]
                )

    async def _check_cancel(self):
        async for job_id in self.cancel_channel.iter(encoding="utf-8"):
            if job_id:
                await self._cancel(job_id)

    async def _get_lg_job(self):
        job_id = await self.redis.lpop("jobs_lg", encoding="utf-8")

        if job_id:
            logger.debug(f"Pulled lg job from Redis: {job_id}")

        return job_id

    async def _get_sm_job(self):
        job_id = await self.redis.lpop("jobs_sm", encoding="utf-8")

        if job_id:
            logger.debug(f"Pulled lg job from Redis: {job_id}")

        return job_id

    async def _start_job(self, job_id):
        document = await self.db.jobs.find_one(job_id, ["task", "args", "proc", "mem"])

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
