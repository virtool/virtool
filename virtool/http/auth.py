import base64
import os
import sys

import aiofiles
from aiohttp import web
from mako.template import Template

import virtool.app_routes
import virtool.db.sessions
import virtool.db.users
import virtool.db.utils

import virtool.errors
import virtool.users
import virtool.utils
from virtool.api.utils import bad_request

AUTHORIZATION_PROJECTION = [
    "user",
    "administrator",
    "groups",
    "permissions"
]


class Client:

    def __init__(self, ip):
        # These attributes are assigned even when the session is not authorized.
        self.ip = ip

        self.administrator = None
        self.authorized = False
        self.user_id = None
        self.groups = None
        self.permissions = None
        self.is_api = False
        self.session_id = None
        self.token = None
        self.force_reset = False

    def authorize(self, document, is_api):
        try:
            user_id = document["user"]["id"]

            self.administrator = document["administrator"]
            self.authorized = True
            self.user_id = user_id
            self.groups = document["groups"]
            self.permissions = document["permissions"]
            self.is_api = is_api
            self.force_reset = document["force_reset"]
        except KeyError:
            pass

    def set_session_id(self, session_id):
        self.session_id = session_id


def decode_authorization(authorization):
    split = authorization.split(" ")

    if len(split) != 2 or split[0] != "Basic":
        raise virtool.errors.AuthError("Malformed authorization header")

    decoded = base64.b64decode(split[1]).decode("utf-8")

    return decoded.split(":")


def get_ip(req):
    return req.transport.get_extra_info("peername")[0]


def get_reset_template():
    return Template(filename=os.path.join(sys.path[0], "templates", "reset.html"))


def get_login_template():
    return Template(filename=os.path.join(sys.path[0], "templates", "login.html"))


@web.middleware
async def middleware(req, handler):
    db = req.app["db"]

    ip = get_ip(req)

    req["client"] = Client(ip)

    authorization = req.headers.get("AUTHORIZATION", None)

    can_use_api_key = req.path[0:4] == "/api" or req.path[0:7] == "/upload"

    # Try API key authorization.
    if req.app["settings"]["enable_api"] and authorization and can_use_api_key:
        try:
            user_id, key = decode_authorization(authorization)
        except virtool.errors.AuthError:
            return bad_request("Malformed Authorization header")

        document = await db.keys.find_one({
            "_id": virtool.users.hash_api_key(key),
            "user.id": user_id
        }, AUTHORIZATION_PROJECTION)

        if not document:
            return bad_request("Invalid Authorization header")

        req["client"].authorize(document, True)

        return await handler(req)

    # Get session information from cookies.
    session_id = req.cookies.get("session_id", None)
    session_token = req.cookies.get("session_token", None)

    session = await virtool.db.sessions.get_session(db, session_id, session_token)

    if session is None:
        session, _ = await virtool.db.sessions.create_session(db, ip)

    req["client"].authorize(session, is_api=False)
    req["client"].session_id = session["_id"]

    resp = await handler(req)

    resp.set_cookie("session_id", req["client"].session_id, httponly=True)

    if not req["client"].user_id:
        resp.del_cookie("session_token")

    return resp


async def index_handler(req):
    if req.app["client_path"] is None:
        try:
            client_path = await virtool.utils.get_client_path()
        except FileNotFoundError:
            return await client_path_error()

        req.app["client_path"] = client_path
        req.app.router.add_static("/static", client_path)

    if req["client"].user_id:
        if req["client"].force_reset:
            return web.Response(status=302, headers={"Location", "/reset"})

        with open(os.path.join(req.app["client_path"], "index.html"), "r") as handle:
            return web.Response(body=handle.read(), content_type="text/html")

    last_path = "/"

    if req.path != "/login":
        last_path = req.path

    await virtool.db.sessions.set_last_path(req.app["db"], req["client"].session_id, last_path)

    return web.Response(status=302, headers={"Location": "/login"})


async def login_get_handler(req):
    db = req.app["db"]

    session_id = req["client"].session_id

    last_path = await virtool.db.utils.get_one_field(db.sessions, "last_path", {"_id": session_id})

    try:
        static_hash = virtool.utils.get_static_hash(req.app["client_path"])
    except FileNotFoundError:
        return await client_path_error()

    verification_key = virtool.utils.random_alphanumeric(32, mixed_case=True)

    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            "key": verification_key,
            "last_path": "/"
        }
    })

    error = req.get("login_error", None)

    html = virtool.http.auth.get_login_template().render(
        verification_key=verification_key,
        hash=static_hash,
        location=last_path,
        error=error
    )

    return web.Response(body=html, content_type="text/html")


async def login_post_handler(req):
    db = req.app["db"]

    client = req["client"]

    form_data = await req.post()

    user_id = form_data.get("username", None)
    password = form_data.get("password", None)
    location = form_data.get("location", "/")
    remember = form_data.get("remember", None) == "on"
    verification_key = form_data.get("verification", None)

    # Check that the hidden verification key matches the one attached to the logging-in session.
    if not await db.sessions.count({"_id": client.session_id, "key": verification_key}):
        return web.HTTPFound(location)

    # Re-render the login page with an error message if the username and/or password are invalid.
    if not await virtool.db.users.validate_credentials(db, user_id, password):
        req["login_error"] = "Invalid username or password"
        return await login_get_handler(req)

    session, token = await virtool.db.sessions.replace_session(db, client.session_id, get_ip(req), user_id)

    req["client"].authorize(session, False)
    req["client"].session_id = session["_id"]

    resp = web.Response(status=302, headers={"Location": location})

    resp.set_cookie("session_token", token)

    return resp


async def reset_get_handler(req):
    db = req.app["db"]

    session_id = req["client"].session_id

    last_path = await virtool.db.utils.get_one_field(db.sessions, "last_path", {"_id": session_id})

    try:
        static_hash = virtool.utils.get_static_hash(req.app["client_path"])
    except FileNotFoundError:
        return await client_path_error()

    verification_key = virtool.utils.random_alphanumeric(32, mixed_case=True)

    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            "key": verification_key,
            "last_path": "/"
        }
    })

    error = req.get("login_error", None)

    html = virtool.http.auth.get_login_template().render(
        verification_key=verification_key,
        hash=static_hash,
        location=last_path,
        error=error
    )

    return web.Response(body=html, content_type="text/html")


async def reset_post_handler(req):
    pass


async def client_path_error():
    async with aiofiles.open(os.path.join(sys.path[0], "templates/client_path_error.html"), "r") as f:
        body = await f.read()
        return web.Response(body=body, content_type="text/html")
