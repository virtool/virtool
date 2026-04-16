from asyncio import gather

from structlog import get_logger

from virtool.jobs.models import QueuedJobID
from virtool.jobs.utils import WORKFLOW_NAMES
from virtool.redis import Redis

logger = get_logger("jobs")


class JobsClient:
    """A jobs client based on Redis.

    Pushes new job IDs to Redis lists to distribute them to job runner processes.

    Cancels jobs by removing waiting job IDs from Redis lists. Running jobs are
    cancelled via ping-based cancellation signaling.

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

    async def cancel(self, job_id: str) -> None:
        """Cancel the job with the given `job_id`.

        Removes the job ID from any Redis queue lists. If the job is already running,
        cancellation is handled by ping-based signaling in the workflow runner.

        :param job_id: the ID of the job to cancel

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
