import logging
import os
import sys
import json
import uvloop
import asyncio
import signal

import virtool.args
import virtool.app
import virtool.logs

sys.dont_write_bytecode = True

logger = logging.getLogger("aiohttp.server")

args = virtool.args.get_args()

virtool.logs.configure(verbose=args.verbose)

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
    host = args.host or settings_temp.get("server_host", "localhost")

    if args.port:
        port = int(args.port)
    else:
        port = settings_temp.get("server_port", 9950)

    loop.run_until_complete(virtool.app.run(
        loop,
        host,
        port,
        skip_setup,
        args.force_version,
        args.no_sentry
    ))
