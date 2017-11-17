import coloredlogs
import logging.handlers

from argparse import ArgumentParser


def get_args():

    parser = ArgumentParser()

    parser.add_argument(
        "-H", "--host",
        dest="host",
        help="hostname to listen on"
    )

    parser.add_argument(
        "-p", "--port",
        dest="port",
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
        action="store_true",
        default=False,
    )

    parser.add_argument(
        "--force-version",
        dest="force_version",
        help="make the server think it is the passed FORCE_VERSION or v1.8.5 if none provided",
        nargs="?",
        const="v1.8.5"
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
