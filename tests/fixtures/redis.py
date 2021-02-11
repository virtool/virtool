import aioredis
import pytest


@pytest.fixture
async def redis(request):
    redis_connection_string = request.config.getoption("redis_connection_string")

    client = await aioredis.create_redis_pool(redis_connection_string)

    yield client

    await client.flushdb()
    client.close()
    await client.wait_closed()


@pytest.fixture()
async def test_channel(redis):
    channel, = await redis.subscribe("channel:test")
    return channel
