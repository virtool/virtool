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
