import aioredis
import pytest


@pytest.fixture
def test_redis_connection_string(request):
    return request.config.getoption("redis_connection_string")


@pytest.fixture
async def redis(request, test_redis_connection_string):
    client = await aioredis.create_redis_pool(test_redis_connection_string)

    yield client

    await client.flushdb()
    client.close()
    await client.wait_closed()


@pytest.fixture()
async def test_channel(redis):
    channel, = await redis.subscribe("channel:test")
    return channel
