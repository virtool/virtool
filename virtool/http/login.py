import os
import random
import sys

from aiohttp import web
from mako.template import Template

import virtool.db.users
import virtool.users
import virtool.utils


def get_login_template():
    return Template(filename=os.path.join(sys.path[0], "templates", "login.html"))


def generate_verification_keys():
    keys = list()

    for _ in range(3):
        key = random.choice(["", virtool.utils.random_alphanumeric(12, mixed_case=True)])
        keys.append(key)

    return keys


async def login_handler(req):
    db = req.app["db"]
    client = req["client"]

    form_data = await req.post()

    user_id = form_data.get("username", None)
    password = form_data.get("password", None)
    location = form_data.get("location", "/")

    authenticated = await virtool.db.users.validate_credentials(db, user_id, password)

    if authenticated:
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

    return web.HTTPFound(location)
