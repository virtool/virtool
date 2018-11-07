import logging
import os
import sys

import aiofiles
from aiohttp import web

import virtool.api.account
import virtool.api.analyses
import virtool.api.downloads
import virtool.api.files
import virtool.api.genbank
import virtool.api.groups
import virtool.api.history
import virtool.api.hmm
import virtool.api.indexes
import virtool.api.jobs
import virtool.api.otus
import virtool.api.processes
import virtool.api.references
import virtool.api.root
import virtool.api.samples
import virtool.api.settings
import virtool.api.software
import virtool.api.subtractions
import virtool.api.uploads
import virtool.api.users
import virtool.api.websocket
import virtool.http.login
import virtool.utils

logger = logging.getLogger(__name__)


async def client_path_error():
    async with aiofiles.open(os.path.join(sys.path[0], "templates/client_path_error.html"), "r") as f:
        body = await f.read()
        return web.Response(body=body, content_type="text/html")


async def index_handler(req):
    if req.app["client_path"] is None:
        try:
            client_path = await virtool.utils.get_client_path()
        except FileNotFoundError:
            return await client_path_error()

        req.app["client_path"] = client_path
        req.app.router.add_static("/static", client_path)

    try:
        static_hash = virtool.utils.get_static_hash(req.app["client_path"])
    except FileNotFoundError:
        return await client_path_error()

    if not req["client"].user_id:
        keys = virtool.http.login.generate_verification_keys()

        session_id = req["client"].session_id

        await req.app["db"].sessions.update_one({"_id": session_id}, {
            "$set": {
                "keys": keys
            }
        })

        html = virtool.http.login.get_login_template().render(
            key_1=keys[0],
            key_2=keys[1],
            key_3=keys[2],
            hash=static_hash,
            location=req.path
        )

        return web.Response(body=html, content_type="text/html")

    with open(os.path.join(req.app["client_path"], "index.html"), "r") as handle:
        return web.Response(body=handle.read(), content_type="text/html")


def setup_routes(app):
    index_paths = [
        "/",
        r"/account{suffix:.*}",
        r"/administration{suffix:.*}",
        r"/home{suffix:.*}",
        r"/hmm{suffix:.*}",
        r"/jobs{suffix:.*}",
        r"/otus{suffix:.*}",
        r"/refs{suffix:.*}",
        r"/samples{suffix:.*}",
        r"/subtraction{suffix:.*}"
    ]

    for path in index_paths:
        app.router.add_get(path, index_handler)

    app.router.add_get("/ws", virtool.api.websocket.root)
    app.router.add_post("/login", virtool.http.login.login_handler)

    app.router.add_routes(virtool.api.account.routes)
    app.router.add_routes(virtool.api.analyses.routes)
    app.router.add_routes(virtool.api.downloads.routes)
    app.router.add_routes(virtool.api.files.routes)
    app.router.add_routes(virtool.api.genbank.routes)
    app.router.add_routes(virtool.api.groups.routes)
    app.router.add_routes(virtool.api.history.routes)
    app.router.add_routes(virtool.api.hmm.routes)
    app.router.add_routes(virtool.api.indexes.routes)
    app.router.add_routes(virtool.api.jobs.routes)
    app.router.add_routes(virtool.api.otus.routes)
    app.router.add_routes(virtool.api.processes.routes)
    app.router.add_routes(virtool.api.references.routes)
    app.router.add_routes(virtool.api.root.routes)
    app.router.add_routes(virtool.api.samples.routes)
    app.router.add_routes(virtool.api.settings.routes)
    app.router.add_routes(virtool.api.software.routes)
    app.router.add_routes(virtool.api.subtractions.routes)
    app.router.add_routes(virtool.api.uploads.routes)
    app.router.add_routes(virtool.api.users.routes)
