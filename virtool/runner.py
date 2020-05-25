import asyncio
import signal
import logging

import aiojobs

import virtool.startup

JOB_STARTUP = [
    virtool.startup.init_version,
    virtool.startup.init_redis,
    virtool.startup.init_settings
]

RUNNER_STARTUP = [
    virtool.startup.init_version,
    virtool.startup.init_redis,
    virtool.startup.init_db,
    virtool.startup.init_settings,
    virtool.startup.init_sentry,
    virtool.startup.init_resources,
    virtool.startup.init_job_manager
]

logger = logging.getLogger(__name__)


async def create_shallow_app(config):
    return {
        "config": config,
        "mode": "runner",
        "scheduler": await aiojobs.create_scheduler()
    }


async def run_runner(config: dict):
    """
    Run a job runner instance.

    :param config: the config values provided by the user

    """
    # This dict poses as an AIOHTTP application and can make use of the same startup and shutdown functions as the
    # web applications.
    app = await create_shallow_app(config)

    for func in RUNNER_STARTUP:
        await func(app)

    logger.info("Ready for jobs")

    async def wait():
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            logging.debug("Closing scheduler")
            await app["scheduler"].close()

    loop = loop = asyncio.get_event_loop()

    task = loop.create_task(wait())

    def handler():
        task.cancel()

    loop.add_signal_handler(signal.SIGINT, handler)
    loop.add_signal_handler(signal.SIGTERM, handler)

    await task
