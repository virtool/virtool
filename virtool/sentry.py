"""Sentry integration for error tracking, performance monitoring, and log capture."""

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from structlog import get_logger

logger = get_logger("sentry")


def traces_sampler(sampling_context: dict) -> float:
    """Sample all transactions except for WebSocket connections.

    This is a Sentry traces sampler function to be used with the Sentry SDK.

    :param sampling_context: A dictionary containing context about the current request.
    :return: A float representing the sampling rate.
    """
    try:
        target_url = sampling_context["aiohttp_request"].rel_url
    except KeyError:
        logger.warning("could not determine sentry transaction name")
        target_url = None

    if target_url == "/ws":
        return 0.0

    return 0.6


def setup(server_version: str | None, dsn: str):
    logger.info(
        "initializing sentry",
        dsn=f"{dsn[:20]}...",
        server_version=server_version,
    )

    sentry_sdk.init(
        dsn=dsn,
        _experiments={
            "enable_logs": True,
        },
        integrations=[
            AioHttpIntegration(),
            LoggingIntegration(event_level=None, level=None),
        ],
        release=server_version,
        traces_sampler=traces_sampler,
    )
