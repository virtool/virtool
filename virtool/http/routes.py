from functools import wraps
from typing import Callable

from aiohttp.web_routedef import RouteTableDef

import virtool.users.utils
from virtool.api.response import json_response, unauthorized


class Routes(RouteTableDef):

    @staticmethod
    def _protected(method):
        @wraps(method)
        def _method(*args, admin=False, permission=None, public=False, **kwargs):
            return protect(method(*args, **kwargs), admin, permission, public)

        return _method

    def __init__(self):
        super().__init__()
        self.get = self._protected(self.get)
        self.post = self._protected(self.post)
        self.delete = self._protected(self.delete)
        self.put = self._protected(self.put)
        self.patch = self._protected(self.patch)

        self.jobs_api = RouteTableDef()


def protect(
        route_decorator: Callable,
        admin: bool,
        permission: str,
        public: bool,
):
    if permission and permission not in virtool.users.utils.PERMISSIONS:
        raise ValueError("Invalid permission: " + permission)

    def decorator(handler):
        async def wrapped(req):
            client = req["client"]

            if not public and client is None:
                return unauthorized("Requires authorization")

            if client is None or not client.administrator:
                if admin:
                    return json_response({
                        "id": "not_permitted",
                        "message": "Requires administrative privilege"
                    }, status=403)

                if permission and not req["client"].permissions[permission]:
                    return json_response({
                        "id": "not_permitted",
                        "message": "Not permitted"
                    }, status=403)

            return await handler(req)

        return route_decorator(wrapped)

    return decorator
