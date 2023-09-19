import logging
from logging import INFO, DEBUG
import structlog


def configure_logs(debug: bool):
    """
    Configure logging for Virtool.

    * Use colored logging.
    * Set short or long line formatting based on configuration options.
    * Set logging level based on ``dev`` configuration option.
    :param debug: log debug messages

    """
    logging.basicConfig(level=DEBUG if debug else INFO, format="%(message)s")

    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(DEBUG if debug else INFO),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M.%S"),
            structlog.processors.CallsiteParameterAdder(
                {
                    structlog.processors.CallsiteParameter.PATHNAME,
                }
            ),
            structlog.dev.ConsoleRenderer(colors=True, sort_keys=True),
        ],
    )
