import os
import sys
import logging.handlers
import coloredlogs
import argparse
import virtool.web

from setproctitle import setproctitle

sys.dont_write_bytecode = True

setproctitle('virtool')

parser = argparse.ArgumentParser()

parser.add_argument(
    "--dev",
    dest="development",
    action="store_true",
    default=False,
    help="Make the server run in development mode."
)

parser.add_argument(
    "--write-pid",
    dest="write_pid",
    action="store_true",
    default=False,
    help="Force the server to write a PID file even if it is development mode"
)

args = parser.parse_args()

logging_level = logging.INFO

logging.captureWarnings(True)

if args.development:
    logging_level = logging.DEBUG

log_format = "%(asctime)-20s %(module)-11s %(levelname)-8s %(message)s"

coloredlogs.install(
    level=logging_level,
    fmt=log_format
)

logger = logging.getLogger('virtool')

handler = logging.handlers.RotatingFileHandler("virtool.log", maxBytes=1000000, backupCount=5)
handler.setFormatter(logging.Formatter(log_format))

logger.addHandler(handler)

pid_path = None

if not args.development or args.write_pid:
    logger.info("writing pid file")

    pid = str(os.getpid())
    pid_path = "/var/run/virtoold/virtoold.pid"

    if os.path.isfile(pid_path):
        logger.fatal('PID file already exists.')
        sys.exit(1)

    with open(pid_path, "w") as pidfile:
        pidfile.write(pid)

server = virtool.web.Application(args.development)

server.run()

if not args.development:
    os.unlink(pid_path)