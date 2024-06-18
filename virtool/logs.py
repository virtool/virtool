import structlog
from sentry_sdk import capture_message
from structlog import PrintLoggerFactory
from structlog.processors import LogfmtRenderer


def sentry_processor(logger, method_name: str, event_dict: dict) -> dict:
    """A structlog processor that sends log messages to Sentry."""
    message = f"{event_dict['time']} {event_dict['level']}\t{event_dict['msg']}"

    message = "\t".join(
        [message]
        + [
            f"{key}={event_dict[key]}"
            for key in [
                key for key in event_dict if key not in ["time", "level", "msg"]
            ]
        ],
    )

    capture_message(message, level=event_dict["level"].lower())

    return event_dict


def configure_logging(use_sentry: bool):
    """Configure logging for Virtool.

    If ``dev`` is enabled, logs will be in color and include debug messages.
    If ``dev`` is disabled, logs will be plain JSON.

    :param fmt: the log format
    :param use_sentry: whether to send logs to Sentry

    """
    processors = [
        structlog.processors.add_log_level,
        structlog.processors.EventRenamer("msg"),
        structlog.processors.TimeStamper(key="time", fmt="%Y-%m-%dT%H:%M:%SZ"),
    ]

    if use_sentry:
        processors.append(sentry_processor)

    processors.append(
        LogfmtRenderer(
            key_order=["time", "level", "logger", "msg"],
        ),
    )

    structlog.configure(
        cache_logger_on_first_use=True,
        logger_factory=PrintLoggerFactory(),
        processors=processors,
    )
