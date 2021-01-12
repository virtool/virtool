import logging.handlers
from rich.logging import RichHandler


def configure(dev, verbose):
    verbose = dev or verbose

    logging_level = logging.DEBUG if verbose else logging.INFO

    logging.captureWarnings(True)

    log_format = "%(asctime)-20s %(module)-11s %(message)s"

    logging.basicConfig(
        level=logging_level,
        format=log_format,
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[RichHandler(level=logging_level, show_time=False, rich_tracebacks=True, markup=True)]
    )

    logger = logging.getLogger("rich")

    handler = logging.handlers.RotatingFileHandler("virtool.log", maxBytes=1000000, backupCount=5)

    logger.addHandler(handler)

    return logger
