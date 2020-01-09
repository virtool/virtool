import logging
import os
import sys

import motor.motor_asyncio
from aiohttp import web
from cerberus import Validator
from mako.template import Template

import virtool.config
import virtool.settings.schema
import virtool.setup.db
import virtool.setup.paths
import virtool.setup.proxy
import virtool.utils
from virtool.api import json_response

logger = logging.getLogger(__name__)


async def unavailable(req):
    return json_response({
        "id": "requires_setup",
        "message": "Server is not configured"
    }, status=503, headers={"Location": "/setup"})


async def redirect(req):
    return web.Response(status=302, headers={"Location": "/setup"})


async def get_main(req):
    """
    Return the setup entry page.

    """
    template = Template(filename=os.path.join(sys.path[0], "templates", "setup.html"))

    html = template.render(hash=virtool.utils.get_static_hash(req))

    return web.Response(body=html, content_type="text/html")


async def get_proxy(req):
    setup = req.app["setup"]

    template = Template(filename=os.path.join(sys.path[0], "templates", "setup_proxy.html"))

    html = template.render(
        error=setup["proxy"]["error"],
        hash=virtool.utils.get_static_hash(req),
        nonce=req["nonce"],
        proxy=setup["proxy"]["proxy"],
        ready=setup["proxy"]["ready"]
    )

    return web.Response(body=html, content_type="text/html")


async def post_proxy(req):

    data = await req.post()

    proxy = data.get("proxy", "")

    result = await virtool.setup.proxy.check(req.app["client"], proxy)

    req.app["setup"]["proxy"].update(result)

    return await get_proxy(req)


async def get_db(req):
    setup = req.app["setup"]

    db_connection_string = setup["db"]["db_connection_string"]
    db_name = setup["db"]["db_name"]
    ready = setup["db"]["ready"]
    error = setup["db"]["error"]

    template = Template(filename=os.path.join(sys.path[0], "templates", "setup_db.html"))

    html = template.render(
        db_connection_string=db_connection_string,
        db_name=db_name,
        hash=virtool.utils.get_static_hash(req),
        error=error,
        nonce=req["nonce"],
        ready=ready
    )

    return web.Response(body=html, content_type="text/html")


async def post_db(req):

    data = await req.post()

    db_connection_string = data.get("db_connection_string", "") or "mongodb://localhost:27017"
    db_name = data.get("db_name", "") or "virtool"

    result = await virtool.setup.db.check_setup(db_connection_string, db_name)

    req.app["setup"]["db"].update(result)

    return await get_db(req)


async def get_path(req):
    mode = "data" if req.path == "/setup/data" else "watch"

    template = Template(filename=os.path.join(sys.path[0], "templates", "setup_path.html"))

    html = template.render(
        hash=virtool.utils.get_static_hash(req),
        **req.app["setup"][mode],
        mode=mode,
        nonce=req["nonce"]
    )

    return web.Response(body=html, content_type="text/html")


async def post_path(req):
    mode = "data" if req.path == "/setup/data" else "watch"

    data = await req.post()

    v = Validator({
        "path": {"type": "string", "coerce": lambda x: x if x else mode, "required": True}
    }, allow_unknown=False)

    v.validate(dict(data))

    path = v.document["path"]

    result = virtool.setup.paths.check_path(path)

    if result is None:
        result = {
            "path": path,
            "error": "",
            "ready": True
        }

    req.app["setup"][mode].update(result)

    return await get_path(req)


async def get_finish(req):
    setup = req.app["setup"]

    config_path = os.path.join(sys.path[0], "config.json")

    proxy = None

    if setup["proxy"]["ready"]:
        proxy = setup["proxy"]["proxy"]

    db_name = setup["db"]["db_name"]

    # Get absolute paths for rendering in setup summary.
    data_path = virtool.setup.paths.ensure_path_absolute(setup["data"]["path"])
    watch_path = virtool.setup.paths.ensure_path_absolute(setup["watch"]["path"])

    template = Template(filename=os.path.join(sys.path[0], "templates", "setup_finish.html"))

    html = template.render(
        config_path=config_path,
        db_name=db_name,
        data_path=data_path,
        hash=virtool.utils.get_static_hash(req),
        nonce=req["nonce"],
        proxy=proxy,
        watch_path=watch_path
    )

    return web.Response(body=html, content_type="text/html")


async def get_save(req):
    setup = req.app["setup"]

    proxy = setup["proxy"]["proxy"]

    db_name = setup["db"]["db_name"]
    db_connection_string = setup["db"]["db_connection_string"]

    client = motor.motor_asyncio.AsyncIOMotorClient(
        setup["db"]["db_connection_string"],
        serverSelectionTimeoutMS=600
    )

    db = client[setup["db"]["db_name"]]

    config = {
        "db_connection_string": db_connection_string,
        "db_name": db_name,
        "data_path": setup["data"]["path"],
        "watch_path": setup["watch"]["path"],
        "proxy": proxy
    }

    virtool.config.remove_defaults(config)

    virtool.config.write_to_file(config)

    await virtool.setup.db.populate_settings(db)

    req.app["events"]["restart"].set()

    return web.Response(status=302, headers={"Location": "/"})
