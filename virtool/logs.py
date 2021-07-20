import logging.handlers
from logging import Logger

import coloredlogs


def get_log_format(verbose: bool) -> str:
    """
    Return a log format given `verbose`, which indicates whether the instance should adopt verbose logging.

    :param verbose: the log format should be verbose

    """
    if verbose:
        return "{asctime:<20} {module:<11} {levelname:<8} {message} ({name}:{funcName}:{lineno})"

    return "{asctime:<20} {module:<11} {levelname:<8} {message}"


def configure_base_logger(dev: bool, verbose: bool) -> Logger:
    """
    Return a base class:`Logger` object that can be used for both runner and server instances.

    Configures the logging level and installs colored logs. If `dev` or `verbose` is `True`, the logger will record
    additional source path information in the log and write logs at the `DEBUG` level.

    :param dev: the logger should produce verbose logs
    :param verbose: the logger should produce verbose logs

    """
    verbose = dev or verbose

    logging_level = logging.DEBUG if verbose else logging.INFO

    logging.captureWarnings(True)

    coloredlogs.install(level=logging_level, fmt=get_log_format(verbose), style="{")

    logger = logging.getLogger()

    return logger


def configure_jobs_api_server(dev: bool, verbose: bool) -> Logger:
    """Configure logging for the jobs API server."""
    logger = configure_base_logger(dev, verbose)

    handler = logging.handlers.RotatingFileHandler(
        "jobs_api_server.log", maxBytes=1000000, backupCount=3
    )

    handler.setFormatter(logging.Formatter(get_log_format(verbose), style="{"))

    logger.addHandler(handler)

    return logger
