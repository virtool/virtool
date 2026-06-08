"""Sentry integration for error tracking, performance monitoring, and log capture."""

import logging
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from structlog import get_logger

logger = get_logger("sentry")

DEFAULT_TRACES_SAMPLE_RATE = 0.6
"""The sample rate applied to transactions that are not explicitly suppressed."""

UNTRACED_PATHS = frozenset(
    {
        "/health/live",
        "/health/ready",
        "/jobs/counts",
        "/tasks/counts",
    },
)
"""Request paths that are never traced.

These are high-frequency, low-value endpoints: orchestrator liveness and readiness
probes and frontend count polling. Tracing them at the default rate exhausts the
trace budget without yielding useful performance data.
"""


def traces_sampler(sampling_context: dict[str, Any]) -> float:
    """Decide the trace sample rate for a transaction.

    Suppress tracing entirely for high-frequency probe and polling endpoints while
    honouring an upstream sampling decision for everything else.
    """
    request = sampling_context.get("aiohttp_request")

    if request is not None and request.path in UNTRACED_PATHS:
        return 0.0

    parent_sampled = sampling_context.get("parent_sampled")

    if parent_sampled is not None:
        return float(parent_sampled)

    return DEFAULT_TRACES_SAMPLE_RATE


def configure_sentry(dsn: str, release: str) -> None:
    if dsn:
        logger.info("initializing sentry", dsn=f"{dsn[:15]}...")

        logger.info(
            "initializing sentry",
            dsn=f"{dsn[:20]}...",
        )

        sentry_sdk.init(
            dsn=dsn,
            _experiments={
                "enable_logs": True,
            },
            integrations=[
                AioHttpIntegration(),
                LoggingIntegration(event_level=logging.WARNING, level=logging.INFO),
            ],
            release=release,
            traces_sampler=traces_sampler,
        )

    else:
        logger.info("sentry disabled because no dsn was provided")
