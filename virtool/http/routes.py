import json.decoder
from functools import wraps
from typing import Any, Callable, Dict

import aiohttp.web
from cerberus import Validator

import virtool.users.utils
from virtool.api.response import invalid_input, json_response, unauthorized
from virtool.http.client import JobClient


class Routes(aiohttp.web.RouteTableDef):

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


def protect(
        route_decorator: Callable,
        admin: bool,
        allow_jobs: bool,
        jobs_only: bool,
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

            is_job_client = isinstance(client, JobClient)

            if is_job_client and not allow_jobs and not jobs_only:
                return json_response({
                    "id": "no_jobs",
                    "message": "Job access is forbidden"
                }, status=403)

            if not is_job_client and jobs_only:
                return json_response({
                    "id": "jobs_only",
                    "message": "Only job access is allowed at this endpoint"
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
