import logging
import sys

import structlog
from structlog.processors import LogfmtRenderer
from structlog_sentry import SentryProcessor

logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
)


def configure_logging(use_sentry: bool):
    """Configure logging for Virtool.

    If ``dev`` is enabled, logs will be in color and include debug messages.
    If ``dev`` is disabled, logs will be plain JSON.

    :param use_sentry: whether to send logs to Sentry

    """
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
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
