import logging.handlers

import coloredlogs


def configure(dev, verbose):
    verbose = dev or verbose

    logging_level = logging.DEBUG if verbose else logging.INFO

    logging.captureWarnings(True)

    log_format = "{asctime:<20} {module<11} {levelname:<8} {message}" \
        if not verbose else \
        "{asctime:<20} {module:<11} {levelname:<8} {message} [{name}:{funcName}:{lineno}]"

    coloredlogs.install(
        level=logging_level,
        fmt=log_format,
        style="{"
    )

    logger = logging.getLogger()

    handler = logging.handlers.RotatingFileHandler("virtool.log", maxBytes=1000000, backupCount=5)
    handler.setFormatter(logging.Formatter(log_format, style="{"))

    logger.addHandler(handler)

    return logger
