import pytest

import virtool.jobs.interface


@pytest.fixture
def jobs_client(dbi, redis):
    app = {
        "db": dbi,
        "redis": redis
    }

    return virtool.jobs.interface.JobsClient(app)


async def test_init(dbi, redis, jobs_client):
    assert jobs_client.redis == redis


@pytest.mark.parametrize("size", ["lg", "sm"])
async def test_enqueue(size, dbi, redis, jobs_client):
    await dbi.jobs.insert_one({
        "_id": "foo",
        "task": "nuvs" if size == "lg" else "create_sample"
    })

    await jobs_client.enqueue("foo")

    key = f"jobs_{size}"

    assert await redis.llen(key) == 1
    assert await redis.lpop(key, encoding="utf-8") == "foo"


@pytest.mark.parametrize("size", ["lg", "sm"])
async def test_cancel_waiting(size, dbi, redis, jobs_client, static_time):
    await redis.rpush(f"jobs_{size}", "foo")

    list_keys = ["jobs_lg", "jobs_sm"]

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
