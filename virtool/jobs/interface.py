import logging
from asyncio import gather

import virtool.db.utils
import virtool.jobs.utils
import virtool.jobs.db
from virtool.jobs.db import PROJECTION

logger = logging.getLogger(__name__)


class JobInterface:

    def __init__(self, app):
        self.db = app["db"]
        self.redis = app["redis"]

    async def enqueue(self, job_id):
        task = await virtool.db.utils.get_one_field(self.db.jobs, "task", job_id)
        size = virtool.jobs.utils.TASK_SIZES[task]

        await self.redis.rpush(f"jobs_{size}", job_id)

        logger.debug(f"Enqueued job: {job_id}")

    async def cancel(self, job_id: str) -> dict:
        """
        Cancel the job with the given `job_id`.

        If the job is still waiting, its ID will be in a Redis list. Remove the ID from the list and append a cancelled
        status records the job document's status field.

        If the job is running, set its state to `cancelling` and publish its ID to the cancellation Redis PubSub
        channel. Listening runners will see the ID and cancel their jobs if their current job ID matches.

        :param job_id: the ID of the job to cancel
        :return: the updated job document

        """
        counts = await gather(
            self.redis.lrem("jobs_lg", 0, job_id),
            self.redis.lrem("jobs_sm", 0, job_id)
        )

        if any(counts):
            logger.debug(f"Removed job from Redis job queue: {job_id}")
            return await virtool.jobs.db.cancel(self.db, job_id)

        document = await self.db.jobs.find_one_and_update({"_id": job_id}, {
            "$set": {
                "state": "cancelling"
            }
        }, projection=PROJECTION)

        await self.redis.publish("channel:cancel", job_id)

        logger.debug(f"Requested job cancellation via Redis: {job_id}")

        return document
