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


def normalize_log_level(
    _logger: object,
    _method_name: str,
    event_dict: EventDict,
) -> EventDict:
    """Map exception method calls to error level.

    The logging module doesn't have EXCEPTION level.

    :param event_dict: the event dictionary
    :return: the event dictionary with the level changed to error

    """
    if event_dict.get("level") == "exception":
        event_dict["level"] = "error"

    return event_dict


def log_deprecated_field(field_name: str, model) -> None:
    """Log a deprecation warning for a field.

    :param field_name: the name of the deprecated field
    :param model: the model class containing the field

    """
    structlog.get_logger("deprecated").warning(
        "use of deprecated field",
        field=field_name,
        model=model.__name__,
    )


def configure_logging(use_sentry: bool) -> None:
    """Configure logging for Virtool.

    :param use_sentry: whether to send logs to Sentry

    """
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_log_level,
        normalize_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="%Y-%m-%dT%H:%M:%SZ"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if use_sentry:
        processors.append(
            SentryProcessor(event_level=logging.WARNING, level=logging.INFO),
        )

    processors.append(
        LogfmtRenderer(
            key_order=["timestamp", "level", "logger", "event"],
        ),
    )

    structlog.configure(
        cache_logger_on_first_use=True,
        logger_factory=structlog.stdlib.LoggerFactory(),
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
    )
