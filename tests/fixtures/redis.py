import pytest
from virtool_core.redis import Redis


@pytest.fixture()
def redis_connection_string(request, worker_id: str) -> str:
    """The connection string for the Redis database used for testing."""
    base_connection_string = request.config.getoption("redis_connection_string")
    number = 0 if worker_id == "master" else int(worker_id[2:])

    return f"{base_connection_string}/{number}"


@pytest.fixture()
async def redis(redis_connection_string, worker_id):
    """A connected Redis client for testing."""
    redis = Redis(redis_connection_string)
    await redis.connect()
    await redis.flushdb()

    yield redis

    await redis.close()
