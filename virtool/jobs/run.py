import asyncio
import signal
import logging

import aiojobs

import virtool.db.mongo
import virtool.redis
import virtool.startup

logger = logging.getLogger(__name__)


async def create_shallow_app(config: dict) -> dict:
    """
    This dict poses as an aiohttp application and can make use of the same startup and shutdown functions as the
    web applications.

    """
    app_dict = {
        "config": config,
        "mode": "runner",
        "scheduler": await aiojobs.create_scheduler()
    }

    await virtool.startup.init_version(app_dict)
    await virtool.startup.init_redis(app_dict)
    await virtool.startup.init_db(app_dict)
    await virtool.startup.init_settings(app_dict)
    await virtool.startup.init_sentry(app_dict)

    return app_dict


async def run(config: dict, cls):
    """
    Run a job runner instance.

    :param config: the config values provided by the user
    :param cls: the runner class to use

    """
    app = await create_shallow_app(config)

    app["jobs"] = cls(
        app,
        None
    )

    await app["scheduler"].spawn(app["jobs"].run())

    logger.info("Ready for jobs")

    async def wait():
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            logging.info("Closing scheduler")
            await app["scheduler"].close()

            logging.info("Closing Redis client")
            app["redis"].close()
            await app["redis"].wait_closed()

    loop = asyncio.get_event_loop()
    task = loop.create_task(wait())

    loop.add_signal_handler(signal.SIGINT, task.cancel)
    loop.add_signal_handler(signal.SIGTERM, task.cancel)

    await task
