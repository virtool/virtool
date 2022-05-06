import logging
from logging import getLogger
from typing import Optional

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = getLogger(__name__)


def setup(server_version: Optional[str], dsn: str):
    logger.info(f"Initializing Sentry with DSN {dsn[:20]}...")
    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            AioHttpIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        release=server_version,
        traces_sample_rate=0.2,
    )
