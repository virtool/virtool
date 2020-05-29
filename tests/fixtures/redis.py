import aioredis
import pytest


@pytest.fixture
async def redis():
    redis_connection_strong = "redis://localhost:6379"
    client = await aioredis.create_redis_pool(redis_connection_strong)

    yield client

    await client.flushdb()
    client.close()
    await client.wait_closed()
