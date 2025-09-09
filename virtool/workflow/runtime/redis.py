from asyncio import CancelledError
from collections.abc import Callable
from contextlib import suppress

from structlog import get_logger

from virtool.redis import Redis

logger = get_logger("redis")


def get_cancellation_channel(redis_client: Redis) -> str:
    """Get the database-specific cancellation channel name.

    :param redis_client: Redis client instance
    :return: the channel name
    """
    return f"channel:cancel:{redis_client.database_id}"


async def get_next_job_id(list_name: str, redis: Redis) -> str:
    """Get the next job ID from a Redis list.

    :param list_name: the name of the list to pop from
    :param redis: the Redis client
    :return: the next job ID

    """
    if (job_id := await redis.blpop(list_name)) is not None:
        logger.info("pulled job id from redis", id=job_id)
        return job_id

    raise ValueError("Unexpected None from job id list")


async def wait_for_cancellation(redis: Redis, job_id: str, func: Callable) -> None:
    """Call a function ``func`` when a job matching ``job_id`` is cancelled.

    :param redis: the Redis client
    :param job_id: the job ID to watch for
    :param func: the function to call when the job is cancelled

    """
    with suppress(CancelledError):
        async for cancelled_job_id in redis.subscribe(get_cancellation_channel(redis)):
            if cancelled_job_id == job_id:
                func()
