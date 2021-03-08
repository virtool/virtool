import aioredis
import pytest
from aioredis import Redis


@pytest.fixture
async def redis_connection_string(request, worker_id):
    base_connection_string = request.config.getoption("redis_connection_string")
    number = 0 if worker_id == "master" else int(worker_id[2:])

    return f"{base_connection_string}/{number}"


@pytest.fixture
async def redis(request, redis_connection_string, worker_id):
    client = await aioredis.create_redis_pool(redis_connection_string)
    await client.flushdb()

    yield client

    await client.flushdb()
    client.close()
    await client.wait_closed()


@pytest.fixture()
async def test_channel(redis: Redis):
    channel, = await redis.subscribe("channel:test")
    return channel
