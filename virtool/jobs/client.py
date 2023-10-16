from abc import ABC, abstractmethod
from asyncio import gather
from typing import List

from structlog import get_logger

from virtool.jobs.utils import WORKFLOW_NAMES
from virtool.types import Document

logger = get_logger("jobs")

JOB_REMOVED_FROM_QUEUE = 0
JOB_CANCELLATION_DISPATCHED = 1


class AbstractJobsClient(ABC):
    @abstractmethod
    async def enqueue(self, workflow: str, job_id: str):
        ...

    @abstractmethod
    async def cancel(self, job_id: str) -> Document:
        ...

    @abstractmethod
    async def list(self) -> Document:
        ...


class JobsClient(AbstractJobsClient):
    """
    A jobs client based on Redis.

    Pushes new job IDs to Redis lists to distribute them to job runner processes.

    Cancels jobs by either:
    * Removing a waiting job ID from a Redis list.
    * Putting a message in Redis PubSub the job runners will see and cancel themselves.

    """

    def __init__(self, redis):
        self._redis = redis

    async def enqueue(self, workflow: str, job_id: str):
        """
        Queue a job in Redis.

        :param workflow: the workflow name
        :param job_id: the job ID
        """
        await self._redis.rpush(f"jobs_{workflow}", job_id)
        logger.debug("Enqueued job", id=job_id, workflow=workflow)

    async def cancel(self, job_id: str) -> int:
        """
        Cancel the job with the given `job_id`.

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
            ]
        )

        if any(counts):
            logger.debug("Removed job from Redis job list", id=job_id)
            return JOB_REMOVED_FROM_QUEUE

        await self._redis.publish("channel:cancel", job_id)
        logger.debug("Requested job cancellation via Redis", id=job_id)

        return JOB_CANCELLATION_DISPATCHED

    async def list(self) -> tuple[str]:
        """
        List all job IDs in Redis.

        :return: a list of job IDs

        """
        return await gather(
            *[
                self._redis.lrange(workflow_name, 0, -1)
                for workflow_name in WORKFLOW_NAMES
            ]
        )


class DummyJobsClient(AbstractJobsClient):
    """
    A jobs client used for testing without pushing job IDs into Redis.
    """

    def __init__(self):
        self.enqueued = []
        self.cancelled = []

    async def enqueue(self, workflow: str, job_id: str):
        self.enqueued.append((workflow, job_id))

    async def cancel(self, job_id: str) -> Document:
        self.cancelled.append(job_id)
        return {}

    async def list(self) -> List[str]:
        return [jobs[1] for jobs in self.enqueued]
