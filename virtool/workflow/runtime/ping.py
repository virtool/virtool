"""Ping the API to keep the job alive."""

import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from aiohttp import ClientOSError, ServerDisconnectedError
from structlog import get_logger

from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.runtime.events import Events

logger = get_logger("api")


async def _ping_periodically(
    api: WorkflowAPIClient,
    job_id: str,
    events: Events,
    parent_task: asyncio.Task,
) -> None:
    retries = 0

    try:
        while True:
            if retries > 5:
                logger.warning("failed to ping server")
                break

            await asyncio.sleep(0.1)

            try:
                response = await api.put_json(f"/jobs/{job_id}/ping", {})
            except (ClientOSError, ServerDisconnectedError):
                await asyncio.sleep(0.3)
                retries += 1
                continue

            if response.get("cancelled"):
                logger.info("received cancellation signal from ping response")
                events.cancelled.set()
                parent_task.cancel()
                break

            await asyncio.sleep(5)
    except asyncio.CancelledError:
        logger.info("stopped pinging server")


@asynccontextmanager
async def ping_periodically(
    api: WorkflowAPIClient,
    job_id: str,
    events: Events,
) -> AsyncIterator[None]:
    """Ping the API to keep the job alive.

    While the context manager is open, a task runs that pings the API every 5 seconds.
    When the context manager is closed, the task is cleanly cancelled.

    If the ping response indicates the job has been cancelled, the events object is
    updated and the parent task is cancelled.

    The ping request is retried up to 5 times before the task is cancelled.

    :param api: The API client.
    :param job_id: The ID of the job to ping.
    :param events: The events object for cancellation signaling.

    """
    parent_task = asyncio.current_task()

    task = asyncio.create_task(_ping_periodically(api, job_id, events, parent_task))

    yield

    task.cancel()

    with contextlib.suppress(asyncio.CancelledError):
        await task
