"""Sentry integration for error tracking, performance monitoring, and log capture."""

import logging
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from structlog import get_logger

logger = get_logger("sentry")

DEFAULT_TRACES_SAMPLE_RATE = 0.6
"""The sample rate applied to transactions that are not explicitly throttled."""

PATH_TRACES_SAMPLE_RATES = {
    "/health/live": 0.0,
    "/health/ready": 0.0,
    "/jobs/counts": 0.01,
    "/tasks/counts": 0.01,
}
"""Per-path trace sample rates for high-frequency, low-value endpoints.

These were exhausting the trace budget at the default rate. Orchestrator liveness
and readiness probes carry no useful performance data and are dropped entirely.
The count-polling endpoints keep a small rate so occasional slowdowns are still
visible.
"""


def traces_sampler(sampling_context: dict[str, Any]) -> float:
    """Decide the trace sample rate for a transaction.

    Throttle high-frequency probe and polling endpoints to their configured rate
    while honouring an upstream sampling decision for everything else.
    """
    request = sampling_context.get("aiohttp_request")

    if request is not None and request.path in PATH_TRACES_SAMPLE_RATES:
        return PATH_TRACES_SAMPLE_RATES[request.path]

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
