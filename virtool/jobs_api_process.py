import asyncio

import aiohttp.web
import aiojobs.aiohttp

import virtool.http.accept
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.logs
import virtool.startup
from virtool.app import create_app_runner, wait_for_restart, wait_for_shutdown


async def start_aiohttp_server(host: str, port: int, **config):
    middlewares = [
        virtool.http.accept.middleware,
        virtool.http.auth.middleware,
        virtool.http.csp.middleware,
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    app: aiohttp.web.Application = aiohttp.web.Application(middlewares=middlewares)

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend([
        virtool.startup.init_db,
        virtool.startup.init_redis,
        virtool.startup.init_settings,
        virtool.startup.init_postgres,
        virtool.startup.init_version,
        virtool.startup.init_events,
    ])

    app["config"] = config
    app["mode"] = "jobs_api_server"

    runner = await create_app_runner(app, host, port)

    return app, runner


async def run(dev: bool, verbose: bool, **config):
    logger = virtool.logs.configure_jobs_api_server(dev, verbose)
    app, runner = await start_aiohttp_server(**config)

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, app["events"]),
         wait_for_shutdown(runner, app["events"])],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
