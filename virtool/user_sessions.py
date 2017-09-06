from virtool.utils import random_alphanumeric


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

    def has_group(self, *args):
        if not all(isinstance(str, arg) for arg in args):
            raise ValueError("Permissions must be of type str")

        return all(grp in self.groups for grp in args)

    def has_permission(self, *args):
        if not all(isinstance(str, arg) for arg in args):
            raise ValueError("Permissions must be of type str")

        return all(self.permissions[perm] is True for perm in args)


async def middleware_factory(app, handler):
    async def middleware_handler(request):

        session_id = request.cookies.get("session_id", None)

        ip = request.transport.get_extra_info("peername")[0]
        user_agent = request.headers["User-Agent"]

        document = None

        if session_id:
            document = await app["db"].sessions.find_one({
                "_id": session_id,
                "ip": ip,
                "user_agent": user_agent
            })

            print(document)

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
