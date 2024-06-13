import logging
from enum import Enum
from logging import INFO

import structlog
from sentry_sdk import capture_message


class LogFormat(Enum):
    """The available log formats."""

    JSON = "json"
    TEXT = "text"


def sentry_processor(logger, method_name: str, event_dict: dict) -> dict:
    """A structlog processor that sends log messages to Sentry."""
    message = structlog.dev.ConsoleRenderer(sort_keys=True)(
        logger,
        method_name,
        event_dict,
    )

    capture_message(message)

    return event_dict


def configure_logging(fmt: LogFormat, use_sentry: bool):
    """Configure logging for Virtool.

    If ``dev`` is enabled, logs will be in color and include debug messages.
    If ``dev`` is disabled, logs will be plain JSON.

    :param fmt: the log format
    :param use_sentry: whether to send logs to Sentry

    """
    logging.basicConfig(level=INFO, format="%(message)s")

    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M.%S"),
    ]

    if use_sentry:
        processors.append(sentry_processor)

    if fmt == LogFormat.JSON:
        processors += [
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    else:
        processors += [
            structlog.dev.ConsoleRenderer(colors=True, sort_keys=True),
        ]

    structlog.configure(
        cache_logger_on_first_use=True,
        logger_factory=structlog.stdlib.LoggerFactory(),
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(INFO),
    )
