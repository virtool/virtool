import base64
import os
import sys
from typing import Tuple

import mako.template
from aiohttp import web

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
            self.session_id = document["_id"]
            self.administrator = document["administrator"]
            self.authorized = True
            self.user_id = document["user"]["id"]
            self.groups = document["groups"]
            self.permissions = document["permissions"]
            self.is_api = is_api
            self.force_reset = document["force_reset"]
        except KeyError:
            pass

    def set_session_id(self, session_id):
        self.session_id = session_id


async def can_use_api_key(req):
    return (req.path[0:4] == "/api" or req.path[0:7] == "/upload") and req.app["settings"]["enable_api"]


async def client_path_error() -> web.Response:
    """
    Returns a response with a rendered error page indicating the the application client files could not be found.

    :return: a response
    """
    html = get_client_file_error_template().render()
    return web.Response(body=html, content_type="text/html")


def get_ip(req: web.Request) -> str:
    """
    A convenience function for getting the client IP address from a :class:`~web.Request` object.

    :param req: the request
    :return: the client's IP address string

    """
    return req.transport.get_extra_info("peername")[0]


def get_client_file_error_template() -> mako.template.Template:
    """
    A convenience function for getting a :class:`~mako.template.Template` for an error page returned when the client
    files cannot be found.

    :return: an error page template

    """
    return mako.template.Template(filename=os.path.join(sys.path[0], "templates", "client_path_error.html"))


def decode_authorization(authorization: str) -> Tuple[str, str]:
    """
    Parse and decode an API key from an HTTP authorization header value. Thje

    :param authorization: the authorization header value for a API request
    :return: a tuple containing the user id and API key parsed from the authorization header

    """
    split = authorization.split(" ")

    if len(split) != 2 or split[0] != "Basic":
        raise virtool.errors.AuthError("Malformed authorization header")

    decoded = base64.b64decode(split[1]).decode("utf-8")

    user_id, key = decoded.split(":")

    return user_id, key


async def authorize_with_api_key(req, handler):
    db = req.app["db"]

    authorization = req.headers.get("AUTHORIZATION")

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


@web.middleware
async def middleware(req, handler):
    db = req.app["db"]

    ip = get_ip(req)

    req["client"] = Client(ip)

    if req.path == "/api/account/login" or req.path == "/api/account/logout":
        return await handler(req)

    if req.headers.get("AUTHORIZATION") and can_use_api_key(req):
        return authorize_with_api_key(req, handler)

    # Get session information from cookies.
    session_id = req.cookies.get("session_id")
    session_token = req.cookies.get("session_token")

    session = await virtool.db.sessions.get_session(db, session_id, session_token)

    if session is None:
        session, _ = await virtool.db.sessions.create_session(db, ip)

    req["client"].authorize(session, is_api=False)
    req["client"].session_id = session["_id"]

    resp = await handler(req)

    if req.path != "/api/account/reset":
        await virtool.db.sessions.clear_reset_code(db, session["_id"])

    resp.set_cookie("session_id", req["client"].session_id, httponly=True)

    if req.path == "/api/":
        resp.del_cookie("session_token")

    return resp


async def index_handler(req: web.Request) -> web.Response:
    """
    A request handler for requests where the `index.html` should be returned.

    :param req: the request to handle
    :return: the response

    """
    requires_first_user = not await req.app["db"].users.count()

    requires_login = not req["client"].user_id

    path = os.path.join(req.app["client_path"], "index.html")

    html = mako.template.Template(filename=path).render()

    html = html.replace("VERSION", req.app["version"])

    html = html.replace('"DEV"', "true" if req.app["settings"]["dev"] else "false")

    html = html.replace('"FIRST"', "true" if requires_first_user else "false")

    html = html.replace('"LOGIN"', "true" if requires_login else "false")

    html = html.replace("NONCE", req["nonce"])

    return web.Response(body=html, content_type="text/html")
