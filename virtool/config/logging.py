import logging
import sys
from logging import DEBUG, INFO

import coloredlogs
import structlog


def configure_logs(debug: bool):
    """
    Configure logging for Virtool.

    * Use colored logging.
    * Set short or long line formatting based on configuration options.
    * Set logging level based on ``dev`` configuration option.
    :param debug: log debug messages

    """

    structlog.configure(
         processors=[
        #     # If log level is too low, abort pipeline and throw away log entry.
              structlog.stdlib.filter_by_level,
        #     # Add the name of the logger to event dict.
             structlog.stdlib.add_logger_name,
             structlog.stdlib.add_log_level,
        #     # Perform %-style formatting.
             structlog.stdlib.PositionalArgumentsFormatter(),
        #     # Add a timestamp in ISO 8601 format.
             structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M.%S"),
        #     # Add callsite parameters.
             structlog.processors.CallsiteParameterAdder(
                 {
                     structlog.processors.CallsiteParameter.PATHNAME,
                 }
             ),
            structlog.dev.ConsoleRenderer(colors=True)
        #
        ],
        # # `wrapper_class` is the bound logger that you get back from
        # # get_logger(). This one imitates the API of `logging.Logger`.
        wrapper_class=structlog.make_filtering_bound_logger(DEBUG if debug else INFO),
        # # `logger_factory` is used to create wrapped loggers that are used for
        # # OUTPUT. This one returns a `logging.Logger`. The final value from
        # # the final processor will be passed to the method of the same name as
        # # that you've called on the bound logger.
        logger_factory=structlog.stdlib.LoggerFactory(),
        # # Effectively freeze configuration after creating the first bound
        # # logger.
        cache_logger_on_first_use=True,
    )
