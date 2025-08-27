"""Sentry integration for error tracking, performance monitoring, and log capture."""

import logging

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from structlog import get_logger

logger = get_logger("sentry")


def _traces_sampler(context: dict) -> float:
    """Sample all transactions except for WebSocket connections.

    This is a Sentry traces sampler function to be used with the Sentry SDK.

    :param context: A dictionary containing context about the current request.
    :return: A float representing the sampling rate.
    """
    try:
        target_url = context["aiohttp_request"].rel_url
    except KeyError:
        logger.warning("could not determine sentry transaction name")
        target_url = None

    if target_url == "/ws":
        return 0.0

    return 0.6


def configure_sentry(dsn: str, release: str) -> None:
    if dsn:
        logger.info("initializing sentry", dsn=f"{dsn[:15]}...")

        logger.info(
            "initializing sentry",
            dsn=f"{dsn[:20]}...",
        )

        sentry_sdk.init(
            dsn=dsn,
            _experiments={
                "enable_logs": True,
            },
            integrations=[
                AioHttpIntegration(),
                LoggingIntegration(event_level=logging.WARNING, level=logging.INFO),
            ],
            release=release,
            traces_sampler=_traces_sampler,
        )

    else:
        logger.info("sentry disabled because no dsn was provided")
