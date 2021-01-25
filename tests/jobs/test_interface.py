import pytest

import virtool.jobs.interface


@pytest.fixture
def job_interface(dbi, redis):
    app = {
        "db": dbi,
        "redis": redis
    }

    return virtool.jobs.interface.JobInterface(app)


async def test_init(dbi, redis, job_interface):
    assert job_interface.redis == redis


@pytest.mark.parametrize("size", ["lg", "sm"])
async def test_enqueue(size, dbi, redis, job_interface):
    await dbi.jobs.insert_one({
        "_id": "foo",
        "task": "nuvs" if size == "lg" else "create_sample"
    })

    await job_interface.enqueue("foo")

    key = f"jobs_{size}"

    assert await redis.llen(key) == 1
    assert await redis.lpop(key, encoding="utf-8") == "foo"


@pytest.mark.parametrize("size", ["lg", "sm"])
async def test_cancel_waiting(size, dbi, redis, job_interface, static_time):
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

    await job_interface.cancel("foo")

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


async def test_cancel_running(dbi, redis, job_interface):
    channel, = await redis.subscribe("channel:cancel")

    await dbi.jobs.insert_one({
        "_id": "foo",
        "state": "running"
    })

    await job_interface.cancel("foo")

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
