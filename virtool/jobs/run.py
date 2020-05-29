import asyncio
import logging
import signal

import aiojobs

import virtool.db.mongo
import virtool.db.utils
import virtool.jobs.agent
import virtool.jobs.classes
import virtool.redis
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
    virtool.startup.init_job_interface
]

logger = logging.getLogger(__name__)


async def create_shallow_app(config):
    return {
        "change_queue": asyncio.Queue(),
        "config": config,
        "mode": "runner",
        "scheduler": await aiojobs.create_scheduler()
    }


async def run_agent(config: dict):
    """
    Run a job agent instance.

    :param config: the config values provided by the user

    """
    # This dict poses as an AIOHTTP application and can make use of the same startup and shutdown functions as the
    # web applications.
    app = await create_shallow_app(config)

    for func in RUNNER_STARTUP:
        await func(app)

    app["jobs"] = virtool.jobs.agent.DistributedJobAgent(
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
            logging.debug("Closing scheduler")
            await app["scheduler"].close()

    loop = asyncio.get_event_loop()

    task = loop.create_task(wait())

    def handler():
        task.cancel()

    loop.add_signal_handler(signal.SIGINT, handler)
    loop.add_signal_handler(signal.SIGTERM, handler)

    await task


async def run_job(config):
    redis = await virtool.redis.connect(config["redis_connection_string"])

    db = await virtool.db.mongo.connect(
        config,
        virtool.redis.create_dispatch(redis)
    )

    document = await db.jobs.find_one({"_id": config["job_id"]}, ["task", "state"])

    if document["state"] == "waiting":
        job_obj = virtool.jobs.classes.TASK_CREATORS[document["task"]]()

        await job_obj.run(
            db,
            redis,
            config,
            config["job_id"]
        )

    redis.close()
    await redis.wait_closed()
