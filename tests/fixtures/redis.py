import aioredis
import pytest
from aioredis import Redis


@pytest.fixture
async def redis_connection_string(request):
    return request.config.getoption("redis_connection_string")


@pytest.fixture
async def redis(redis_connection_string) -> Redis:
    client = await aioredis.create_redis_pool(redis_connection_string)


@pytest.fixture
async def redis(request, redis_connection_string):
    client = await aioredis.create_redis_pool(redis_connection_string)

    yield client

    await client.flushdb()
    client.close()
    await client.wait_closed()


@pytest.fixture()
async def test_channel(redis: Redis):
    channel, = await redis.subscribe("channel:test")
    return channel
