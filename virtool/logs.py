import logging.handlers

import coloredlogs


def configure(dev, verbose):
    verbose = dev or verbose

    logging_level = logging.DEBUG if verbose else logging.INFO

    logging.captureWarnings(True)

    log_format = "%(asctime)-20s %(module)-11s %(levelname)-8s %(message)s"

    coloredlogs.install(
        level=logging_level,
        fmt=log_format
    )

    logger = logging.getLogger()

    handler = logging.handlers.RotatingFileHandler("virtool.log", maxBytes=1000000, backupCount=5)
    handler.setFormatter(logging.Formatter(log_format))

    logger.addHandler(handler)

    return logger
