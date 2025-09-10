from asyncio import gather
from enum import Enum

from structlog import get_logger

from virtool.jobs.models import QueuedJobID
from virtool.jobs.utils import WORKFLOW_NAMES
from virtool.redis import Redis
from virtool.workflow.runtime.redis import get_cancellation_channel

logger = get_logger("jobs")


class JobCancellationResult(Enum):
    """The result of a job cancellation request."""

    CANCELLATION_DISPATCHED = 1
    """Whether the job cancellation was dispatched to job runners."""

    REMOVED_FROM_QUEUE = 0
    """Whether the job was removed from the queue."""


class JobsClient:
    """A jobs client based on Redis.

    Pushes new job IDs to Redis lists to distribute them to job runner processes.

    Cancels jobs by either:
    * Removing a waiting job ID from a Redis list.
    * Putting a message in Redis PubSub the job runners will see and cancel themselves.

    """

    def __init__(self, redis: Redis) -> None:
        """Initialize the JobsClient with a Redis instance."""
        self._redis = redis

    async def enqueue(self, workflow: str, job_id: str) -> QueuedJobID:
        """Queue a job in Redis.

        :param workflow: the workflow name
        :param job_id: the job ID
        """
        list_length = await self._redis.rpush(f"jobs_{workflow}", job_id)

        logger.info(
            "enqueued job in redis",
            list_length=list_length,
            id=job_id,
            workflow=workflow,
        )

        return QueuedJobID(job_id, workflow)

    async def cancel(self, job_id: str) -> JobCancellationResult:
        """Cancel the job with the given `job_id`.

        If the job is still waiting, its ID will be in a Redis list. Remove the ID from
        the list and append a cancelled status records the job document's status field.

        If the job is running, set its state to `cancelling` and publish its ID to the
        cancellation Redis PubSub channel. Listening runners will see the ID and cancel
        their jobs if their current job ID matches.

        :param job_id: the ID of the job to cancel
        :return: the updated job document

        """
        counts = await gather(
            *[
                self._redis.lrem(workflow_name, 0, job_id)
                for workflow_name in WORKFLOW_NAMES
            ],
        )

        if any(counts):
            logger.info("removed job from redis job list", id=job_id)
            return JobCancellationResult.REMOVED_FROM_QUEUE

        await self._redis.publish(get_cancellation_channel(self._redis), job_id)
        logger.info("requested job cancellation via redis", id=job_id)

        return JobCancellationResult.CANCELLATION_DISPATCHED

    async def remove(self, job_id: str) -> None:
        """Remove a job from Redis queues without cancellation logic.

        :param job_id: the ID of the job to remove
        """
        await gather(
            *[
                self._redis.lrem(workflow_name, 0, job_id)
                for workflow_name in WORKFLOW_NAMES
            ],
        )

        logger.info("removed job from redis job list", id=job_id)

    async def list(self) -> list[QueuedJobID]:
        """List all job IDs in Redis.

        :return: a list of job IDs
        """
        workflow_specific_jobs_ids = await gather(
            *[
                self._redis.lrange(workflow_name, 0, -1)
                for workflow_name in WORKFLOW_NAMES
            ],
        )

        return [
            QueuedJobID(job_id, workflow_name)
            for workflow_name, job_ids in zip(
                WORKFLOW_NAMES, workflow_specific_jobs_ids, strict=False
            )
            for job_id in job_ids
        ]
