import logging

import virtool.db.utils
import virtool.jobs.utils

logger = logging.getLogger(__name__)


class JobInterface:

    def __init__(self, app):
        self.db = app["db"]
        self.redis = app["redis"]

    async def enqueue(self, job_id):
        task = await virtool.db.utils.get_one_field(self.db.jobs, "task", job_id)
        size = virtool.jobs.utils.TASK_SIZES[task]

        await self.redis.rpush(f"jobs_{size}", job_id)

        logger.debug(f"Enqueued job via Redis: {job_id}")

    async def cancel(self, job_id):
        """
        Cancel the job with the given `job_id` if it is in the `_jobs_dict`.

        """
        document = await self.db.jobs.find_one_and_update({"_id": job_id}, {
            "$set": {
                "state": "cancelling"
            }
        })

        await self.redis.lrem("jobs_lg", 0, job_id)
        await self.redis.lrem("jobs_sm", 0, job_id)
        await self.redis.publish("channel:cancel", job_id)

        logger.debug(f"Requested job cancellation via Redis: {job_id}")

        return document
