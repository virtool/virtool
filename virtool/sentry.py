"""Sentry integration for error tracking, performance monitoring, and log capture."""

import logging

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from structlog import get_logger

logger = get_logger("sentry")


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
            traces_sample_rate=0.6,
        )

    else:
        logger.info("sentry disabled because no dsn was provided")
