import asyncio

import pytest
from virtool_core.redis import Redis

from virtool.jobs.client import (
    JobCancellationResult,
    JobsClient,
)


@pytest.fixture()
def jobs_client(redis: Redis) -> JobsClient:
    return JobsClient(redis)


@pytest.mark.parametrize("workflow", ["create_sample", "nuvs"])
async def test_enqueue(workflow: str, jobs_client: JobsClient, redis: Redis):
    """Test that a job ID is put in the correct job list when enqueued."""
    await jobs_client.enqueue(workflow, "foo")

    key = f"jobs_{workflow}"

    assert await redis.llen(key) == 1
    assert await redis.lpop(key) == "foo"


@pytest.mark.parametrize("workflow", ["nuvs", "create_sample"])
async def test_cancel_waiting(workflow: str, jobs_client: JobsClient, redis: Redis):
    """Test that a job ID is cancelled by removal when still in a Redis list."""
    await redis.rpush(f"jobs_{workflow}", "foo")

    keys = ("jobs_nuvs", "jobs_create_sample")

    for key in keys:
        await redis.rpush(key, "bar", "foo", "baz", "boo")

    assert await jobs_client.cancel("foo") == JobCancellationResult.REMOVED_FROM_QUEUE

    for key in keys:
        assert await redis.lrange(key, 0, 5) == ["bar", "baz", "boo"]


async def test_cancel_running(jobs_client: JobsClient, redis: Redis):
    """Test that cancellation is published to 'channel:cancel' if the job ID is not in a
    list already.

    """

    async def cancel():
        await asyncio.sleep(0.3)
        await jobs_client.cancel("foo")

    cancel_task = asyncio.create_task(cancel())

    # Check that job ID was published to cancellation channel.
    async for message in redis.subscribe("channel:cancel"):
        assert message == "foo"
        break

    await cancel_task
