import asyncio

from aiohttp import ClientConnectionError, ClientSession, TCPConnector
from structlog import get_logger

from virtool.jobs.models import JobAcquired
from virtool.workflow.errors import (
    JobAlreadyAcquiredError,
    JobsAPIError,
    JobsAPIServerError,
)

logger = get_logger("api")


async def acquire_job_by_id(
    jobs_api_connection_string: str,
    job_id: str,
) -> JobAcquired:
    """Acquire the job with a given ID via the API.

    :param jobs_api_connection_string: The url for the jobs API.
    :param job_id: The id of the job to acquire
    :return: a job including its API key
    """
    async with ClientSession(
        connector=TCPConnector(force_close=True, limit=100),
    ) as session:
        attempts = 4

        while attempts > 0:
            try:
                async with session.patch(
                    f"{jobs_api_connection_string}/jobs/{job_id}",
                    json={"acquired": True},
                ) as resp:
                    logger.info("acquiring job", remaining_attempts=attempts, id=job_id)

                    if resp.status == 200:
                        job_json = await resp.json()
                        logger.info("acquired job", id=job_id)
                        return JobAcquired(**job_json)

                    if resp.status == 400:
                        if "already acquired" in await resp.text():
                            raise JobAlreadyAcquiredError(await resp.json())

                    logger.critical(
                        "unexpected api error during job acquisition",
                        status=resp.status,
                        body=await resp.text(),
                    )

                    raise JobsAPIError("Unexpected API error during job acquisition")

            except ClientConnectionError:
                logger.warning(
                    "unable to connect to server. retrying in 1 second.",
                    remaining_attemtps=attempts,
                    id=job_id,
                )
                await asyncio.sleep(1)

            attempts -= 1

    raise JobsAPIServerError("Unable to connect to server.")
