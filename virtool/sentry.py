import logging
from logging import getLogger
from typing import Optional, Dict

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = getLogger(__name__)


def traces_sampler(sampling_context: Dict) -> float:
    try:
        target_url = sampling_context["aiohttp_request"].rel_url
    except KeyError:
        logger.warning("Could not determine Sentry transaction name")
        target_url = None

    if target_url == "/ws":
        return 0.0

    return 0.2


def setup(server_version: Optional[str], dsn: str):
    logger.info(f"Initializing Sentry with DSN {dsn[:20]}...")
    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            AioHttpIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        release=server_version,
        traces_sampler=traces_sampler,
    )
