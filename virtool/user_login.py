import os
import sys
import random
from aiohttp import web
from mako.template import Template

import virtool.user
import virtool.utils


def get_login_template():
    return Template(filename=os.path.join(sys.path[0], "virtool", "templates", "login.html"))


def generate_verification_keys():
    keys = list()

    for _ in range(3):
        key = random.choice(["", virtool.utils.random_alphanumeric(12, mixed_case=True)])
        keys.append(key)

    return keys


async def login_handler(req):
    db = req.app["db"]
    session = req["session"]

    form_data = await req.post()

    username = form_data.get("username", None)
    password = form_data.get("password", None)
    location = form_data.get("location", "/")

    authenticated = await virtool.user.validate_credentials(db, username, password)

    if authenticated:
        user_document = await db.users.find_one(username)

        await req.app["db"].sessions.update_one({"_id": session.id}, {
            "$set": {
                "user_id": username,
                "groups": user_document["groups"],
                "permissions": user_document["permissions"]
            }
        })

        session.user_id = username
        session.groups = user_document["groups"]
        session.permissions = user_document["permissions"]

    return web.HTTPFound(location)
