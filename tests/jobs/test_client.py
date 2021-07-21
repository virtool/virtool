import pytest

from virtool.jobs.client import JobsClient


@pytest.fixture
def jobs_client(dbi, redis):
    app = {
        "db": dbi,
        "redis": redis
    }

    return JobsClient(app)


async def test_init(dbi, redis, jobs_client):
    assert jobs_client.redis == redis


@pytest.mark.parametrize("workflow_name", ["nuvs", "create_sample"])
async def test_enqueue(workflow_name, dbi, redis, jobs_client):
    await dbi.jobs.insert_one({
        "_id": "foo",
        "task": workflow_name
    })

    await jobs_client.enqueue("foo")

    key = f"jobs_{workflow_name}"

    assert await redis.llen(key) == 1
    assert await redis.lpop(key, encoding="utf-8") == "foo"


@pytest.mark.parametrize("workflow_name", ["nuvs", "create_sample"])
async def test_cancel_waiting(workflow_name, dbi, redis, jobs_client, static_time):
    await redis.rpush(f"jobs_{workflow_name}", "foo")

    list_keys = ["jobs_nuvs", "jobs_create_sample"]

    for key in list_keys:
        await redis.rpush(key, "bar", "foo", "baz", "boo")

    await dbi.jobs.insert_one({
        "_id": "foo",
        "state": "waiting",
        "status": [{
            "state": "running",
            "stage": "foo",
            "error": None,
            "progress": 0.33,
            "timestamp": static_time.datetime
        }]
    })

    await jobs_client.cancel("foo")

    # Check that job ID was removed from lists.
    for key in list_keys:
        assert await redis.lrange(key, 0, 5, encoding="utf-8") == ["bar", "baz", "boo"]

    # Check that job document was updated.
    assert await dbi.jobs.find_one() == {
        "_id": "foo",
        "state": "waiting",
        "status": [
            {
                "state": "running",
                "stage": "foo",
                "error": None,
                "progress": 0.33,
                "timestamp": static_time.datetime
            },
            {
                "state": "cancelled",
                "stage": "foo",
                "error": None,
                "progress": 0.33,
                "timestamp": static_time.datetime
            }
        ]
    }


async def test_cancel_running(dbi, redis, jobs_client):
    channel, = await redis.subscribe("channel:cancel")

    await dbi.jobs.insert_one({
        "_id": "foo",
        "state": "running"
    })

    await jobs_client.cancel("foo")

    # Check that cancelling state is set of job document.
    assert await dbi.jobs.find_one() == {
        "_id": "foo",
        "state": "cancelling"
    }

    # Check that job ID was published to cancellation channel.
    async for message in channel.iter(encoding="utf-8"):
        assert message == "foo"
        break

    await redis.unsubscribe("channel:cancel")
