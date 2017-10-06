import virtool.user
import virtool.utils
from virtool.handlers.utils import bad_request


AUTHENICATION_PROJECTION = ["user_id", "groups", "permissions"]


class Client:

    def __init__(self, ip, user_agent):
        # These attributes are assigned even when the session is not authorized.
        self.ip = ip
        self.user_agent = user_agent

        self.authenticated = False
        self.user_id = None
        self.groups = None
        self.permissions = None
        self.is_api = False

    def authenticate(self, document, is_api):
        self.authenticated = True
        self.user_id = document["user_id"]
        self.groups = document["groups"]
        self.permissions = document["permissions"]
        self.is_api = is_api


async def middleware_factory(app, handler):
    async def middleware_handler(req):
        ip = req.transport.get_extra_info("peername")[0]
        user_agent = req.headers["User-Agent"]

        req["client"] = Client(ip, user_agent)

        # Check if there is a session_id in cookies.
        session_id = req.cookies.get("session_id", None)

        # Try API key authentication if there was no session_id.
        if app["settings"].get("enable_api") and not session_id and req.path[0:5] == "/api":
            authentication = req.headers.get("Authentication", None)

            if authentication:
                split = authentication.split(":")

                if not len(split) == 2:
                    return bad_request("Malformed Authentication header")

                user_id, key = split

                document = await app["db"].keys.find_one({
                    "key": virtool.user.hash_api_key(key),
                    "user_id": user_id
                }, AUTHENICATION_PROJECTION)

                if not document:
                    return bad_request("Invalid Authentication header")

                req["client"].authenticate(document, True)

                return await handler(req)

        document = await app["db"].sessions.find_one({
            "_id": session_id,
            "ip": ip,
            "user_agent": user_agent
        }, AUTHENICATION_PROJECTION)

        if document:
            req["client"].authenticate(document, False)
        else:
            session_id = virtool.utils.random_alphanumeric(128, mixed_case=True),

            await app["db"].sessions.insert_one({
                "_id": session_id,
                "ip": ip,
                "user_agent": user_agent
            })

        response = await handler(req)

        response.set_cookie("session_id", session_id)

        return response

    return middleware_handler
