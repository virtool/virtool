import aiohttp
import aiojobs

import virtool.http.accept
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.startup


async def start_aiohttp_server():
    middlewares = [
        virtool.http.accept.middleware,
        virtool.http.auth.middleware,
        virtool.http.csp.middleware,
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    app = aiohttp.web.Application(middlewares=middlewares)

    aiojobs.aiohttp.setup(app)

    app.on_startup += [
        virtool.startup.init_check_db,
        virtool.startup.init_db,
        virtool.startup.init_paths,
        virtool.startup.init_postgres,
        virtool.startup.init_settings,
        virtool.startup.init_version,
    ]


async def run(**kwargs):
    ...
