import asyncio
from typing import Tuple

import aiojobs.aiohttp
import virtool.http.accept
import virtool.http.errors
import virtool.jobs.auth
from aiohttp.web import Application, AppRunner
from virtool.config.cls import Config
from virtool.dev.fake import drop_fake_mongo, remove_fake_data_path
from virtool.jobs.routes import startup_routes
from virtool.process_utils import (create_app_runner, wait_for_restart,
                                   wait_for_shutdown)
from virtool.shutdown import drop_fake_postgres
from virtool.startup import (startup_db, startup_events, startup_executors,
                             startup_fake, startup_fake_config,
                             startup_postgres, startup_redis, startup_settings)
from virtool.types import App


async def create_app(config: Config):
    """Create the :class:`aiohttp.web.Application` for the jobs API process."""
    middlewares = [
        virtool.http.accept.middleware,
        virtool.jobs.auth.middleware,
        virtool.http.errors.middleware
    ]
    
    app = Application(client_max_size=1024 ** 2 * 20, middlewares=middlewares)

    app["config"] = config
    app["mode"] = "jobs_api_server"

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend([
        startup_fake_config,
        startup_redis,
        startup_db,
        startup_postgres,
        startup_settings,
        startup_executors,
        startup_fake,
        startup_events,
        startup_routes,
    ])

    app.on_shutdown.extend([
        shutdown,
        drop_fake_mongo,
        drop_fake_postgres,
        remove_fake_data_path,
    ])

    return app


async def shutdown(app: App):
    try:
        app["redis"].close()
        await app["redis"].wait_closed()
    except KeyError:
        pass


async def start_aiohttp_server(
        config: Config
) -> Tuple[Application, AppRunner]:
    """
    Create the :class:`aiohttp.web.Application` and start the aiohttp server
    for the jobs API process.
    """
    app = await create_app(config)
    runner = await create_app_runner(app, config.host, config.port)

    return app, runner


async def run(config: Config):
    """
    Run the jobs API server.

    :param config: Any other configuration options as keyword arguments
    """
    app, runner = await start_aiohttp_server(config)

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, app["events"]),
         wait_for_shutdown(runner, app["events"])],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for job in pending:
        job.cancel()
