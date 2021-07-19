import asyncio
import logging

import virtool.db.core
import virtool.db.utils
import virtool.errors
import virtool.indexes.db
import virtool.jobs.db
import virtool.jobs.utils
import virtool.otus.db
import virtool.redis
import virtool.samples.db
import virtool.utils

logger = logging.getLogger(__name__)


class JobRunner:

    def __init__(self, app, capture_exception):
        self.db = app["db"]
        self.redis = app["redis"]
        self.settings = app["settings"]

    async def _get_job_from_list(self, key):
        job_id = await self.redis.lpop(key, encoding="utf-8")

        if job_id:
            logger.debug(f"Pulled job '{job_id}' from Redis list '{key}'")

        return job_id

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
