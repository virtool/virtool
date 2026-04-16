import asyncio

from aiohttp import ClientConnectionError, ClientSession, TCPConnector
from structlog import get_logger

from virtool.jobs.models import CreateJobClaimRequest, JobAcquired, JobClaimed
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


async def claim_job_by_polling(
    jobs_api_connection_string: str,
    workflow: str,
    claim_request: CreateJobClaimRequest,
    poll_interval: float = 2.0,
) -> JobClaimed:
    """Poll the jobs API to claim a job.

    Repeatedly calls ``POST /jobs/claim`` until a job is claimed. Raises
    ``asyncio.CancelledError`` when the calling task is cancelled (e.g. by a
    timeout wrapper).

    :param jobs_api_connection_string: the URL for the jobs API
    :param workflow: the workflow name to claim a job for
    :param claim_request: the claim request body with runner metadata
    :param poll_interval: seconds between poll attempts
    :return: the claimed job
    """
    async with ClientSession(
        connector=TCPConnector(force_close=True, limit=100),
    ) as session:
        while True:
            try:
                async with session.post(
                    f"{jobs_api_connection_string}/jobs/claim",
                    params={"workflow": workflow},
                    json=claim_request.dict(),
                ) as resp:
                    if resp.status == 200:
                        job_json = await resp.json()
                        logger.info("claimed job", id=job_json.get("id"))
                        return JobClaimed(**job_json)

                    if resp.status == 404:
                        await asyncio.sleep(poll_interval)
                        continue

                    logger.critical(
                        "unexpected api error during job claim",
                        status=resp.status,
                        body=await resp.text(),
                    )

                    raise JobsAPIError("Unexpected API error during job claim")

            except ClientConnectionError:
                logger.warning(
                    "unable to connect to server. retrying.",
                )
                await asyncio.sleep(poll_interval)
