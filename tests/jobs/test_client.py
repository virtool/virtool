import pytest

from virtool.jobs.client import JobsClient


@pytest.fixture
def jobs_client(dbi, redis):
    return JobsClient({"db": dbi, "redis": redis})


@pytest.mark.parametrize("workflow", ["nuvs", "create_sample"])
async def test_enqueue(workflow, dbi, redis, jobs_client):
    await dbi.jobs.insert_one({"_id": "foo", "workflow": workflow})

    await jobs_client.enqueue("foo")

    key = f"jobs_{workflow}"

    assert await redis.llen(key) == 1
    assert await redis.lpop(key, encoding="utf-8") == "foo"


@pytest.mark.parametrize("workflow", ["nuvs", "create_sample"])
async def test_cancel_waiting(workflow, dbi, redis, jobs_client, snapshot, static_time):
    await redis.rpush(f"jobs_{workflow}", "foo")

    list_keys = ["jobs_nuvs", "jobs_create_sample"]

    for key in list_keys:
        await redis.rpush(key, "bar", "foo", "baz", "boo")

    await dbi.jobs.insert_one(
        {
            "_id": "foo",
            "state": "waiting",
            "status": [
                {
                    "state": "running",
                    "stage": "foo",
                    "error": None,
                    "progress": 0.33,
                    "timestamp": static_time.datetime,
                }
            ],
        }
    )

    await jobs_client.cancel("foo")

    for key in list_keys:
        assert await redis.lrange(key, 0, 5, encoding="utf-8") == ["bar", "baz", "boo"]

    assert await dbi.jobs.find_one() == snapshot


async def test_cancel_running(dbi, redis, jobs_client):
    (channel,) = await redis.subscribe("channel:cancel")

    await dbi.jobs.insert_one({"_id": "foo", "state": "running"})

    await jobs_client.cancel("foo")

    # Check that cancelling state is set of job document.
    assert await dbi.jobs.find_one() == {"_id": "foo", "state": "cancelling"}

    # Check that job ID was published to cancellation channel.
    async for message in channel.iter(encoding="utf-8"):
        assert message == "foo"
        break

    await redis.unsubscribe("channel:cancel")
