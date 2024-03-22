from virtool_core.redis import Redis , create_redis_pool
import pytest



@pytest.fixture
def redis_connection_string(request, worker_id: str) -> str:
    """
    The connection string for the Redis database used for testing.
    """
    base_connection_string = request.config.getoption("redis_connection_string")
    number = 0 if worker_id == "master" else int(worker_id[2:])

    return f"{base_connection_string}/{number}"


@pytest.fixture
async def redis(redis_connection_string, worker_id):
    """
    A connected Redis client for testing.
    """
    client = await create_redis_pool(redis_connection_string)
    await client.flushdb()

    yield client
    await client.flushdb()
    await client.close()


@pytest.fixture()
async def channel(redis: Redis):
    (channel,) = await redis.subscribe("channel:test")
    return channel
