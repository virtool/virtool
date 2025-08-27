"""Ping the API to keep the job alive."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from aiohttp import ClientOSError, ServerDisconnectedError
from structlog import get_logger

from virtool.workflow.api.client import APIClient

logger = get_logger("api")


async def _ping_periodically(api: APIClient, job_id: str) -> None:
    retries = 0

    try:
        while True:
            if retries > 5:
                logger.warning("failed to ping server")
                break

            await asyncio.sleep(0.1)

            try:
                await api.put_json(f"/jobs/{job_id}/ping", {})
            except (ClientOSError, ServerDisconnectedError):
                await asyncio.sleep(0.3)
                retries += 1
                continue

            await asyncio.sleep(5)
    except asyncio.CancelledError:
        logger.info("stopped pinging server")


@asynccontextmanager
async def ping_periodically(api: APIClient, job_id: str) -> AsyncIterator[None]:
    """Ping the API to keep the job alive.

    While the context manager is open, a task runs that pings the API every 5 seconds.
    When the context manager is closed, the task is cleanly cancelled.

    The ping request is retried up to 5 times before the task is cancelled.

    :param api: The API client.
    :param job_id: The ID of the job to ping.

    """
    task = asyncio.create_task(_ping_periodically(api, job_id))

    yield

    task.cancel()
    await task
