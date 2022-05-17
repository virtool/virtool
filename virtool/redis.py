import asyncio
import logging
import sys
from typing import Optional
from aioredis import Redis, create_redis_pool, Channel, ConnectionClosedError
import aiojobs


logger = logging.getLogger(__name__)


async def connect(redis_connection_string: str, scheduler_from_app: aiojobs.Scheduler) -> Redis:
    """
    Create connection to Redis server specified in passed `redis_connection_string`.

    Will exit the application if the server cannot be reached.

    :param redis_connection_string: the Redis connection string
    :param scheduler_from_app: the app scheduler object
    :return: a Redis connection object

    """
    if not redis_connection_string.startswith("redis://"):
        logger.fatal("Invalid Redis connection string")
        sys.exit(1)

    logger.info("Connecting to Redis")

    try:
        redis = await create_redis_pool(redis_connection_string)
        await check_version(redis)

        scheduler = scheduler_from_app
        await scheduler.spawn(periodically_ping_redis(redis))

        return redis
    except ConnectionRefusedError:
        logger.fatal("Could not connect to Redis: Connection refused")
        sys.exit(1)


async def periodically_ping_redis(redis: Redis):
    """
    Ping the Redis server every two minutes.

    When using Azure Cache for Redis, connections that are inactive for more than
    10 minutes are dropped. Regular pings prevent this from happening.

    :param redis: the Redis client

    """
    while True:
        await asyncio.sleep(120)
        await redis.ping()


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


async def resubscribe(redis: Redis, redis_channel_name: str) -> Channel:
    """
    Subscribe to the passed channel of the passed :class:`Redis` object.

    :param redis: the Redis connection
    :param redis_channel_name: name of the channel to reconnect to
    :return: Channel

    """
    while True:
        try:
            (channel,) = await redis.subscribe(redis_channel_name)
            return channel
        except (ConnectionRefusedError, ConnectionResetError, ConnectionClosedError):
            await asyncio.sleep(5)
