import asyncio

import pytest
from virtool_core.redis import Redis


@pytest.fixture(scope="session")
async def _redis_cache() -> dict[str, Redis]:
    """A cache for Redis clients."""
    cache = {}
    yield cache
    await asyncio.gather(*(client.close() for client in cache.values()))


@pytest.fixture()
def redis_connection_string(request, worker_id: str) -> str:
    """The connection string for the Redis database used for testing."""
    base_connection_string = request.config.getoption("redis_connection_string")
    number = 0 if worker_id == "master" else int(worker_id[2:])

    return f"{base_connection_string}/{number}"


@pytest.fixture()
async def redis(_redis_cache: dict[str, Redis], redis_connection_string: str) -> Redis:
    """A connected Redis client for testing."""
    if redis_connection_string in _redis_cache:
        redis = _redis_cache[redis_connection_string]
    else:
        redis = Redis(redis_connection_string)
        await redis.connect()
        _redis_cache[redis_connection_string] = redis

    await redis.flushdb()

    return redis
