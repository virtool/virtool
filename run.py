import os
import sys
import json
import uvloop
import asyncio

from aiohttp import web
from setproctitle import setproctitle
from virtool.app import create_app
from virtool.app_init import get_args, configure

sys.dont_write_bytecode = True

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
    app = create_app(loop, skip_setup=skip_setup)

    host = args.host or settings_temp.get("server_host", "localhost")
    port = args.port or settings_temp.get("server_port", 9950)

    web.run_app(app, host=host, port=port)
