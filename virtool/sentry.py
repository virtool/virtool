import logging

import sentry_sdk
import sentry_sdk.integrations.aiohttp
import sentry_sdk.integrations.logging
sentry_logging = sentry_sdk.integrations.logging.LoggingIntegration(
    level=logging.INFO,
    event_level=logging.ERROR
)


def setup(server_version, dsn):
    sentry_sdk.init(
        dsn=dsn,
        integrations=[sentry_sdk.integrations.aiohttp.AioHttpIntegration(), sentry_logging],
        release=server_version,
        traces_sample_rate=0.2
    )
