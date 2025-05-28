import logging
import sys

import structlog
from structlog.processors import LogfmtRenderer
from structlog.types import EventDict
from structlog_sentry import SentryProcessor

logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
)


def _exception_level_to_error(
    _: logging.Logger,
    __: str,
    event_dict: EventDict,
) -> EventDict:
    """Convert the log level of an exception event to error.

    The `structlog_sentry` processor does not like the `exception` level which is used
    by `structlog`.

    :param event_dict: the event dictionary
    :return: the event dictionary with the level changed to error

    """
    if event_dict.get("level") == "exception":
        event_dict["level"] = "error"

    return event_dict


def configure_logging(use_sentry: bool):
    """Configure logging for Virtool.

    If ``dev`` is enabled, logs will be in color and include debug messages.
    If ``dev`` is disabled, logs will be plain JSON.

    :param use_sentry: whether to send logs to Sentry

    """
    processors = [
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="%Y-%m-%dT%H:%M:%SZ"),
        structlog.stdlib.PositionalArgumentsFormatter(),
    ]

    if use_sentry:
        processors.extend(
            [
                _exception_level_to_error,
                SentryProcessor(event_level=logging.WARNING, level=logging.INFO),
            ],
        )

    processors.extend(
        [
            structlog.stdlib.filter_by_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            LogfmtRenderer(
                key_order=["timestamp", "level", "logger", "event"],
            ),
        ],
    )

    structlog.configure(
        cache_logger_on_first_use=True,
        logger_factory=structlog.stdlib.LoggerFactory(),
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
    )
