import logging
import os
import sys
import json
import uvloop
import asyncio

from aiohttp import web
from virtool.app import create_app
from virtool.app_init import get_args, configure

sys.dont_write_bytecode = True

logger = logging.getLogger("aiohttp.server")

args = get_args()

configure(verbose=args.verbose)

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
    app = create_app(
        loop,
        skip_setup=skip_setup,
        force_version=args.force_version,
        no_sentry=args.no_sentry
    )

    host = args.host or settings_temp.get("server_host", "localhost")

    if args.port:
        port = int(args.port)
    else:
        port = settings_temp.get("server_port", 9950)

    web.run_app(app, host=host, port=port)
