import logging.handlers
from rich.logging import RichHandler


def configure(dev, verbose):
    verbose = dev or verbose

    logging_level = logging.DEBUG if verbose else logging.INFO

    logging.captureWarnings(True)

    log_file_format = "{asctime:<20} {levelname:<8} {module:<11} {message} [{name}:{funcName}:{lineno}]"
    log_format = "%(asctime)-20s %(levelname)-8s %(module)-11s %(message)8s"

    logging.basicConfig(
        level=logging_level,
        format=log_format,
        datefmt="[%Y-%m-%d %H:%M:%S]",
        handlers=[RichHandler(level=logging_level, show_time=False, show_level=False, rich_tracebacks=True, markup=True)]
    )

    logger = logging.getLogger()

    handler = logging.handlers.RotatingFileHandler("virtool.log", maxBytes=1000000, backupCount=5)
    handler.setFormatter(logging.Formatter(log_file_format, style="{"))

    logger.addHandler(handler)

    return logger
