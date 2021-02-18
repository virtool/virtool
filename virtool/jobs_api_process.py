import asyncio
import logging

import aiohttp
import aiojobs

import virtool.http.accept
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.startup
from virtool.app import create_app_runner

logger = logging.getLogger(__name__)


async def start_aiohttp_server(host: str, port: int, config: dict):
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
    ])

    app["config"] = config
    app["mode"] = "jobs_api_server"

    runner = await create_app_runner(app, host, port)

    return runner


async def run(**kwargs):
    logger.info("foo")
    runner = await start_aiohttp_server("localhost", 5000, kwargs)

    await asyncio.sleep(10)
