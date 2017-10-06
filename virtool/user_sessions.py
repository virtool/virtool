from virtool.utils import random_alphanumeric
from virtool.handlers.utils import bad_request


class Session:

    def __init__(self, session_document):
        # These attributes are assigned even when the session is not authorized.
        self.id = session_document["_id"]
        self.ip = session_document["ip"]
        self.user_agent = session_document["user_agent"]

        # The attributes are only assigned when the session is authorized.
        self.user_id = session_document.get("user_id", None)
        self.groups = session_document.get("groups", None)
        self.permissions = session_document.get("permissions", None)


async def middleware_factory(app, handler):
    async def middleware_handler(request):

        session_id = request.cookies.get("session_id", None)

        if app["settings"].get("enable_api") and not session_id and request.path[0:5] == "/api":
            authentication = request.headers.get("Authentication", None)

            if authentication:
                split = authentication.split(":")

                if not len(split) == 2:
                    return bad_request("Invalid authentication header")

                user = await app["db"].users.find_one()

        ip = request.transport.get_extra_info("peername")[0]
        user_agent = request.headers["User-Agent"]

        document = None

        if session_id:
            document = await app["db"].sessions.find_one({
                "_id": session_id,
                "ip": ip,
                "user_agent": user_agent
            })

        if not document:
            document = {
                "_id": random_alphanumeric(128, mixed_case=True),
                "ip": ip,
                "user_agent": user_agent
            }

            await app["db"].sessions.insert_one(document)

        session = Session(document)

        request["session"] = session

        response = await handler(request)

        response.set_cookie("session_id", request["session"].id)

        return response

    return middleware_handler
