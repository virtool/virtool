import json.decoder
from typing import Any, Callable, Dict

import aiohttp.web
from cerberus import Validator

import virtool.users.utils
from virtool.api.response import invalid_input, json_response, unauthorized
from virtool.http.client import JobClient


class Routes(aiohttp.web.RouteTableDef):

    def __init__(self):
        super().__init__()

    def get(self, *args, admin=False, allow_jobs=False, permission=None, public=False, schema=None,
            **kwargs):
        route_decorator = super().get(*args, **kwargs)
        return protect(route_decorator, admin, allow_jobs, permission, public, schema)

    def post(self, *args, admin=False, allow_jobs=False, permission=None, public=False,
             schema=None, **kwargs):
        route_decorator = super().post(*args, **kwargs)
        return protect(route_decorator, admin, allow_jobs, permission, public, schema)

    def patch(self, *args, admin=False, allow_jobs=False, permission=None, public=False,
              schema=None, **kwargs):
        route_decorator = super().patch(*args, **kwargs)
        return protect(route_decorator, admin, allow_jobs, permission, public, schema)

    def put(self, *args, admin=False, allow_jobs=False, permission=None, public=False, schema=None,
            **kwargs):
        route_decorator = super().put(*args, **kwargs)
        return protect(route_decorator, admin, allow_jobs, permission, public, schema)

    def delete(self, *args, admin=False, allow_jobs=False, permission=None, public=False,
               schema=None, **kwargs):
        route_decorator = super().delete(*args, **kwargs)
        return protect(route_decorator, admin, allow_jobs, permission, public, schema)


def protect(
        route_decorator: Callable,
        admin: bool,
        allow_jobs: bool,
        permission: str,
        public: bool,
        schema: Dict[str, Any]
):
    if permission and permission not in virtool.users.utils.PERMISSIONS:
        raise ValueError("Invalid permission: " + permission)

    def decorator(handler):
        async def wrapped(req):
            client = req["client"]

            if not public and client is None:
                return unauthorized("Requires authorization")

            if isinstance(client, JobClient) and not allow_jobs:
                return json_response({
                    "id": "no_jobs",
                    "message": "Job access is forbidden"
                }, status=403)

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

            content_type = req.headers.get("Content-type", "")

            if "multipart/form-data" not in content_type:
                try:
                    data = await req.json()
                except (json.decoder.JSONDecodeError, UnicodeDecodeError):
                    data = dict()

                if schema:
                    v = Validator(schema, purge_unknown=True)

                    if not v.validate(data):
                        return invalid_input(v.errors)

                    data = v.document

                req["data"] = data

            return await handler(req)

        return route_decorator(wrapped)

    return decorator
