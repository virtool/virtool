import os
import sys
import uvloop
import asyncio

from aiohttp import web
from setproctitle import setproctitle
from virtool.web import create_app
from virtool.logs import configure
from virtool.args import get_args

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

if __name__ == "__main__":
    app = create_app(loop)
    web.run_app(app, host="localhost", port=9950)
