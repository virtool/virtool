import coloredlogs
import logging.handlers

from argparse import ArgumentParser


def get_args():

    parser = ArgumentParser()

    parser.add_argument(
        "-H", "--host",
        dest="host",
        default="localhost",
        help="hostname to listen on"
    )

    parser.add_argument(
        "-p", "--port",
        dest="port",
        default=9550,
        help="port to listen on"
    )

    parser.add_argument(
        "-v", "--verbose",
        dest="verbose",
        action="store_true",
        default=False,
        help="log debug messages"
    )

    parser.add_argument(
        "-P", "--write-pid",
        dest="write_pid",
        action="store_true",
        default=False,
        help="write a pidfile on start"
    )

    return parser.parse_args()


def configure(verbose=False):
    logging_level = logging.INFO if verbose else logging.DEBUG

    logging.captureWarnings(True)

    log_format = "%(asctime)-20s %(module)-11s %(levelname)-8s %(message)s"

    coloredlogs.install(
        level=logging_level,
        fmt=log_format
    )

    logger = logging.getLogger("virtool")

    handler = logging.handlers.RotatingFileHandler("virtool.log", maxBytes=1000000, backupCount=5)
    handler.setFormatter(logging.Formatter(log_format))

    logger.addHandler(handler)

    return logger
