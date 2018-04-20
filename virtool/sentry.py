import logging
from raven import Client
from raven.conf import setup_logging
from raven.handlers.logging import SentryHandler
from raven_aiohttp import AioHttpTransport

ACCESS_TOKEN = "c52c9c3a9f1811e7bdaa4201c0a8d02a"


def setup(server_version):
    client = Client(
        "https://9a2f8d1a3f7a431e873207a70ef3d44d:ca6db07b82934005beceae93560a6794@sentry.io/220532",
        transport=AioHttpTransport,
        release=server_version
    )

    handler = SentryHandler(client)
    handler.setLevel(logging.ERROR)

    setup_logging(handler)

    return client
