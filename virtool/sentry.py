import logging

import sentry_sdk
import sentry_sdk.integrations.aiohttp
import sentry_sdk.integrations.logging

DSN = "https://9a2f8d1a3f7a431e873207a70ef3d44d:ca6db07b82934005beceae93560a6794@sentry.io/220532"

sentry_logging = sentry_sdk.integrations.logging.LoggingIntegration(
    level=logging.INFO,
    event_level=logging.ERROR
)


def setup(server_version):
    sentry_sdk.init(
        dsn=DSN,
        integrations=[sentry_sdk.integrations.aiohttp.AioHttpIntegration(), sentry_logging],
        release=server_version,
        traces_sample_rate=0.2
    )
