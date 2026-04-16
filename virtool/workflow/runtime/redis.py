from structlog import get_logger

from virtool.redis import Redis

logger = get_logger("redis")


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
