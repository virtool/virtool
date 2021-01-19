import logging.handlers

import coloredlogs


def get_log_format(verbose):
    if verbose:
        return "{asctime:<20} {module:<11} {levelname:<8} {message} [{name}:{funcName}:{lineno}]"

    return "{asctime:<20} {module:<11} {levelname:<8} {message}"


def configure_base_logger(dev, verbose):
    verbose = dev or verbose

    logging_level = logging.DEBUG if verbose else logging.INFO

    logging.captureWarnings(True)

    coloredlogs.install(
        level=logging_level,
        fmt=get_log_format(verbose),
        style="{"
    )

    logger = logging.getLogger()

    return logger


def configure_server(dev, verbose):
    logger = configure_base_logger(dev, verbose)

    handler = logging.handlers.RotatingFileHandler("server.log", maxBytes=1000000, backupCount=3)
    handler.setFormatter(logging.Formatter(get_log_format(verbose), style="{"))

    logger.addHandler(handler)

    return logger


def configure_runner(dev, verbose):
    logger = configure_base_logger(dev, verbose)

    handler = logging.handlers.RotatingFileHandler("runner.log", maxBytes=1000000, backupCount=3)
    handler.setFormatter(logging.Formatter(get_log_format(verbose), style="{"))

    logger.addHandler(handler)

    return logger
