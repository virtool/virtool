import logging

import virtool.db.utils
import virtool.jobs.utils

logger = logging.getLogger(__name__)


class DistributedJobInterface:

    def __init__(self, app, capture_exception):
        self.db = app["db"]
        self.redis = app["redis"]
        self.cancel_channel = None

    async def enqueue(self, job_id):
        task = await virtool.db.utils.get_one_field(self.db.jobs, "task", job_id)
        size = virtool.jobs.utils.TASK_SIZES[task]

        await self.redis.rpush(f"jobs_{size}", job_id)

        logger.debug(f"Enqueued job via Redis: {job_id}")

    async def cancel(self, job_id):
        """
        Cancel the job with the given `job_id` if it is in the `_jobs_dict`.

        """
        await self.redis.publish("channel:cancel", job_id)
        logger.debug(f"Requested job cancellation via Redis: {job_id}")