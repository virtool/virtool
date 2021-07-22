import logging
from asyncio import gather

from virtool.db.utils import get_one_field
from virtool.jobs.db import PROJECTION, cancel

logger = logging.getLogger(__name__)


WORKFLOW_NAMES = (
    "jobs_build_index",
    "jobs_create_sample",
    "jobs_create_subtraction",
    "jobs_aodp",
    "jobs_nuvs",
    "jobs_pathoscope_bowtie"
)


class JobsClient:

    def __init__(self, app):
        self.db = app["db"]
        self.redis = app["redis"]

    async def enqueue(self, job_id):
        workflow = await get_one_field(self.db.jobs, "workflow", job_id)

        await self.redis.rpush(f"jobs_{workflow}", job_id)

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
        lrem_calls = [self.redis.lrem(workflow_name, 0, job_id) for workflow_name in WORKFLOW_NAMES]
        counts = await gather(*lrem_calls)

        if any(counts):
            logger.debug(f"Removed job from Redis job queue: {job_id}")
            return await cancel(self.db, job_id)

        document = await self.db.jobs.find_one_and_update({"_id": job_id}, {
            "$set": {
                "state": "cancelling"
            }
        }, projection=PROJECTION)

        await self.redis.publish("channel:cancel", job_id)

        logger.debug(f"Requested job cancellation via Redis: {job_id}")

        return document
