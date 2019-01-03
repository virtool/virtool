import os
import sys

from aiohttp import web
from mako.template import Template

import virtool.app_routes
import virtool.db.users
import virtool.users
import virtool.utils


def get_login_template():
    return Template(filename=os.path.join(sys.path[0], "templates", "login.html"))


def get_reset_template():
    return Template(filename=os.path.join(sys.path[0], "templates", "reset.html"))


async def login_post_handler(req):
    db = req.app["db"]
    client = req["client"]

    form_data = await req.post()

    user_id = form_data.get("username", None)
    password = form_data.get("password", None)
    location = form_data.get("location", "/")
    verification_key = form_data.get("verification", None)

    session = await db.sessions.find_one(client.session_id, ["key"])

    if session is None or session["key"] != verification_key:
        return web.HTTPFound(location)

    if await virtool.db.users.validate_credentials(db, user_id, password):
        user_document = await db.users.find_one(user_id)

        document = await req.app["db"].sessions.find_one_and_update({"_id": client.session_id}, {
            "$set": {
                "administrator": user_document["administrator"],
                "groups": user_document["groups"],
                "permissions": user_document["permissions"],
                "user": {
                    "id": user_id
                }
            }
        })

        client.authorize(document, False)

    req["login_error"] = "Invalid username or password"

    return await virtool.app_routes.index_handler(req)
