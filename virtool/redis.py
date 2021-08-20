import logging
import sys
from typing import Optional

from aioredis import Redis, from_url

logger = logging.getLogger(__name__)


async def connect(redis_connection_string: str) -> Redis:
    """
    Create a connection to the Redis server specified in the passed `redis_connection_string`.

    Will exit the application if the server cannot be reached.

    :param redis_connection_string: the Redis connection string
    :return: a Redis connection object

    """
    if all(
        not redis_connection_string.startswith(protocol)
        for protocol in ("redis://", "rediss://")
    ):
        logger.fatal("Invalid Redis connection string")
        sys.exit(1)

    try:
        redis = await from_url(redis_connection_string)
        await check_version(redis)

        return redis
    except ConnectionRefusedError:
        logger.fatal("Could not connect to Redis: Connection refused")
        sys.exit(1)


async def check_version(redis: Redis) -> Optional[str]:
    """
    Check the version of the server represented in the passed :class:`Redis` object.

    The version is logged and returned by the function.

    :param redis: the Redis connection
    :return: the version

    """
    info = await redis.execute("INFO", encoding="utf-8")

    for line in info.split("\n"):
        if line.startswith("redis_version"):
            version = line.replace("redis_version:", "")
            logger.info(f"Found Redis {version}")

            return version

    return None
