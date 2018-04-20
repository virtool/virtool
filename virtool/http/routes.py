import aiohttp.web
from cerberus import Validator

import virtool.users
from virtool.api.utils import json_response, invalid_input


class Routes(aiohttp.web.RouteTableDef):

    def __init__(self):
        super().__init__()

    def get(self, *args, admin=True, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().get(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def post(self, *args, admin=True, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().post(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def patch(self, *args, admin=True, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().patch(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def put(self, *args, admin=True, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().put(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)

    def delete(self, *args, admin=True, permission=None, public=False, schema=None, **kwargs):
        route_decorator = super().delete(*args, **kwargs)
        return protect(route_decorator, admin, permission, public, schema)


def protect(route_decorator, admin, permission, public, schema):

    if permission and permission not in virtool.users.PERMISSIONS:
        raise ValueError("Invalid permission: " + permission)

    def decorator(handler):
        handler = route_decorator(handler)

        async def wrapped(req):
            if not req["client"].user_id:
                return json_response({
                    "id": "requires_authorization",
                    "message": "Requires authorization"
                }, status=401)

            if permission and not req["client"].permissions[permission]:
                return json_response({
                    "id": "not_permitted",
                    "message": "Not permitted"
                }, status=403)

            v = Validator(schema)

            data = await req.json()

            if not v.validate(data):
                return invalid_input(v.errors)

            req["data"] = v.document

            return await handler(req)

        return wrapped

    return decorator
