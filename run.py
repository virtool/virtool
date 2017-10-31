import logging
import os
import sys
import ssl
import json
import uvloop
import asyncio

from aiohttp import web
from raven import Client
from raven.conf import setup_logging
from raven.handlers.logging import SentryHandler
from raven_aiohttp import AioHttpTransport
from setproctitle import setproctitle
from virtool.app import create_app
from virtool.app_init import get_args, configure

sys.dont_write_bytecode = True

sentry_client = Client('https://9a2f8d1a3f7a431e873207a70ef3d44d:ca6db07b82934005beceae93560a6794@sentry.io/220532', transport=AioHttpTransport)
sentry_handler = SentryHandler(sentry_client)
sentry_handler.setLevel(logging.ERROR)
setup_logging(sentry_handler)

logger = logging.getLogger("aiohttp.server")
logger.addHandler(sentry_handler)

setproctitle("virtool")

args = get_args()

logger = configure(verbose=args.verbose)

if args.write_pid:
    logger.debug("Writing pid file")

    pid = str(os.getpid())
    pid_path = "/var/run/virtoold/virtoold.pid"

    if os.path.isfile(pid_path):
        logger.fatal("PID file already exists.")
        sys.exit(1)

    with open(pid_path, "w") as pidfile:
        pidfile.write(pid)


asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

loop = asyncio.get_event_loop()

settings_path = os.path.join(sys.path[0], "settings.json")

skip_setup = os.path.isfile(settings_path)

try:
    with open(settings_path, "r") as handle:
        settings_temp = json.load(handle)
except FileNotFoundError:
    settings_temp = dict()

if __name__ == "__main__":
    ssl_context = None

    if settings_temp.get("use_ssl", False):
        cert_path = settings_temp.get("cert_path", None)
        key_path = settings_temp.get("key_path", None)

        if cert_path and key_path:
            ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            ssl_context.load_cert_chain(cert_path, key_path)

    app = create_app(loop, skip_setup=skip_setup)

    host = args.host or settings_temp.get("server_host", "localhost")
    port = args.port or settings_temp.get("server_port", 9950)

    web.run_app(app, host=host, port=port, ssl_context=ssl_context)
