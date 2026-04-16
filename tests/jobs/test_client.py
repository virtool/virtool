import pytest

from virtool.jobs.client import JobsClient
from virtool.redis import Redis


@pytest.fixture
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
    """Test that a job ID is removed from Redis lists when cancelled."""
    await redis.rpush(f"jobs_{workflow}", "foo")

    keys = ("jobs_nuvs", "jobs_create_sample")

    for key in keys:
        await redis.rpush(key, "bar", "foo", "baz", "boo")

    await jobs_client.cancel("foo")

    for key in keys:
        assert await redis.lrange(key, 0, 5) == ["bar", "baz", "boo"]
