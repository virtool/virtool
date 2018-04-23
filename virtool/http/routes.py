import aiohttp.web
import json.decoder
from cerberus import Validator

import virtool.users
from virtool.api.utils import json_response, invalid_input


class Routes(aiohttp.web.RouteTableDef):

    def __init__(self):
        super().__init__()

    def get(self, *args, admin=False, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().get(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def post(self, *args, admin=False, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().post(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def patch(self, *args, admin=False, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().patch(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def put(self, *args, admin=False, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().put(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def delete(self, *args, admin=False, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().delete(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)


def protect(route_decorator, admin, permission, public, schema):

    if permission and permission not in virtool.users.PERMISSIONS:
        raise ValueError("Invalid permission: " + permission)

    def decorator(handler):

        async def wrapped(req):

            if not public and not req["client"].user_id:
                return json_response({
                    "id": "requires_authorization",
                    "message": "Requires authorization"
                }, status=401)

            if permission and not req["client"].permissions[permission]:
                return json_response({
                    "id": "not_permitted",
                    "message": "Not permitted"
                }, status=403)

            content_type = req.headers.get("Content-type", "")

            if "multipart/form-data" not in content_type:
                try:
                    data = await req.json()
                except (json.decoder.JSONDecodeError, UnicodeDecodeError):
                    data = None

                if data and schema:
                    v = Validator(schema)

                    if not v.validate(data):
                        return invalid_input(v.errors)

                    data = v.document

                req["data"] = data

            return await handler(req)

        return route_decorator(wrapped)

    return decorator
