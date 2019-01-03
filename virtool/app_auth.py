import base64

from aiohttp import web

import virtool.errors
import virtool.users
import virtool.utils
from virtool.api.utils import bad_request

AUTHORIZATION_PROJECTION = ["user", "administrator", "groups", "permissions"]


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

    def authorize(self, document, is_api):
        self.administrator = document["administrator"]
        self.authorized = True
        self.user_id = document["user"]["id"]
        self.groups = document["groups"]
        self.permissions = document["permissions"]
        self.is_api = is_api

    def set_session_id(self, session_id):
        self.session_id = session_id


@web.middleware
async def middleware(req, handler):
    ip = req.transport.get_extra_info("peername")[0]

    req["client"] = Client(ip)

    authorization = req.headers.get("AUTHORIZATION", None)

    can_use_api_key = req.path[0:4] == "/api" or req.path[0:7] == "/upload"

    # Try API key authorization if there was no session_id.
    if authorization and req.app["settings"].get("enable_api") and can_use_api_key:
        if authorization:
            try:
                user_id, key = decode_authorization(authorization)
            except virtool.errors.AuthError:
                return bad_request("Malformed Authorization header")

            document = await req.app["db"].keys.find_one({
                "_id": virtool.users.hash_api_key(key),
                "user.id": user_id
            }, AUTHORIZATION_PROJECTION)

            if not document:
                return bad_request("Invalid Authorization header")

            req["client"].authorize(document, True)

            return await handler(req)

    # Check if there is a session_id in cookies.
    session_id = req.cookies.get("session_id", None)

    document = await req.app["db"].sessions.find_one({
        "_id": session_id
    })

    if document:
        user_id = None

        try:
            user_id = document["user"]["id"]
        except KeyError:
            pass

        if user_id:
            req["client"].authorize(document, False)
    else:
        session_id = virtool.utils.random_alphanumeric(128, mixed_case=True)

        await req.app["db"].sessions.insert_one({
            "_id": session_id,
            "ip": ip
        })

    req["client"].set_session_id(session_id)

    response = await handler(req)

    response.set_cookie("session_id", session_id)

    return response


def decode_authorization(authorization):
    split = authorization.split(" ")

    if len(split) != 2 or split[0] != "Basic":
        raise virtool.errors.AuthError("Malformed authorization header")

    decoded = base64.b64decode(split[1]).decode("utf-8")

    return decoded.split(":")
