import asyncio
from asyncio import CancelledError
from collections.abc import Callable

from structlog import get_logger

from virtool.redis import Redis

logger = get_logger("redis")

CANCELLATION_CHANNEL = "channel:cancel"


async def get_next_job_with_timeout(
    list_name: str,
    redis: Redis,
    timeout: int | None = None,
) -> str:
    """Get the next job ID from a Redis list.

    Raise a  :class:``Timeout`` error if an ID is not found in ``timeout``
    seconds.

    :param list_name: the name of the list to pop from
    :param redis: the Redis client
    :param timeout: seconds to wait before raising :class:``Timeout``
    :return: the next job ID
    """
    logger.info(
        "waiting for a job",
        timeout=f"{timeout if timeout else 'infinity'} seconds",
    )

    return await asyncio.wait_for(get_next_job(list_name, redis), timeout)


async def get_next_job(list_name: str, redis: Redis) -> str:
    """Get the next job ID from a Redis list.

    :param list_name: the name of the list to pop from
    :param redis: the Redis client
    :return: the next job ID

    """
    if (job_id := await redis.blpop(list_name)) is not None:
        logger.info("pulled job id from redis", id=job_id)
        return job_id

    raise ValueError("Unexpected None from job id list")


async def wait_for_cancellation(redis: Redis, job_id: str, func: Callable):
    """Call a function ``func`` when a job matching ``job_id`` is cancelled.

    :param redis: the Redis client
    :param job_id: the job ID to watch for
    :param func: the function to call when the job is cancelled

    """
    try:
        async for cancelled_job_id in redis.subscribe(CANCELLATION_CHANNEL):
            if cancelled_job_id == job_id:
                return func()

    except CancelledError:
        ...
