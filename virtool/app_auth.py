import base64

import virtool.user
import virtool.utils
import virtool.errors
from virtool.handlers.utils import bad_request


AUTHORIZATION_PROJECTION = ["user", "groups", "permissions"]


class Client:

    def __init__(self, ip, user_agent):
        # These attributes are assigned even when the session is not authorized.
        self.ip = ip
        self.user_agent = user_agent

        self.authorized = False
        self.user_id = None
        self.groups = None
        self.permissions = None
        self.is_api = False
        self.session_id = None

    def authorize(self, document, is_api):
        self.authorized = True
        self.user_id = document["user"]["id"]
        self.groups = document["groups"]
        self.permissions = document["permissions"]
        self.is_api = is_api

    def set_session_id(self, session_id):
        self.session_id = session_id


async def middleware_factory(app, handler):
    async def middleware_handler(req):
        ip = req.transport.get_extra_info("peername")[0]
        user_agent = req.headers["User-Agent"]

        req["client"] = Client(ip, user_agent)

        authorization = req.headers.get("AUTHORIZATION", None)

        # Try API key authorization if there was no session_id.
        if authorization and app["settings"].get("enable_api") and req.path[0:4] == "/api":
            if authorization:
                try:
                    user_id, key = decode_authorization(authorization)
                except virtool.errors.AuthError:
                    return bad_request("Malformed Authorization header")

                document = await app["db"].keys.find_one({
                    "_id": virtool.user.hash_api_key(key),
                    "user.id": user_id
                }, AUTHORIZATION_PROJECTION)

                if not document:
                    return bad_request("Invalid Authorization header")

                req["client"].authorize(document, True)

                return await handler(req)

        # Check if there is a session_id in cookies.
        session_id = req.cookies.get("session_id", None)

        document = await app["db"].sessions.find_one({
            "_id": session_id,
            "ip": ip,
            "user_agent": user_agent
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

            await app["db"].sessions.insert_one({
                "_id": session_id,
                "ip": ip,
                "user_agent": user_agent
            })

        req["client"].set_session_id(session_id)

        response = await handler(req)

        response.set_cookie("session_id", session_id)

        return response

    return middleware_handler


def decode_authorization(authorization):
    split = authorization.split(" ")

    try:
        assert len(split) == 2
        assert split[0] == "Basic"

        decoded = base64.b64decode(split[1]).decode("utf-8")

    except AssertionError:
        raise virtool.errors.AuthError("Malformed authorization header")

    return decoded.split(":")
