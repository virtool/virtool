from functools import wraps
from typing import Callable, Any

import aiohttp.web
from aiohttp.web_routedef import RouteDef

import virtool.users.utils
from virtool.api.response import json_response, unauthorized
from virtool.types import RouteHandler


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

        self.job_routes = []

    def route(self,
              method: str,
              path: str,
              jobs_only: bool = False,
              allow_jobs: bool = True,
              **kwargs: Any) -> Callable[[RouteHandler], RouteHandler]:
        """
        Create a decorator which registers an aiohttp route.

        This function is called by :class:`RouteTableDef`'s method functions, such as :func:`.get`. Any keyword
        arguments passed to those functions will be forwarded here, allowing the `jobs_only` and `allow_jobs`
        flags to be handled.

        :param method: The name of the method type. Constants for these names are contained in `aiohttp.hdrs` and
            are prefixed with `METH_`.
        :param path: The path of the route.
        :param jobs_only: If True, the route will be added to the :obj:`.job_routes` attribute only.
        :param allow_jobs: If True,  the route will be added to the route table, and to :obj:`.job_routes`.
        :param kwargs: Any keyword arguments are passed to the `RouteDef` object.
        :return: A decorator which adds the :class:`RouteHandler` to the route table, and/or :obj:`.job_routes`
        """

        if jobs_only:
            def _route_decorator(handler: RouteHandler):
                self.job_routes.append(RouteDef(method, path, handler, {}))
                return handler
        elif allow_jobs:
            def _route_decorator(handler: RouteHandler):
                self.job_routes.append(RouteDef(method, path, handler, {}))
                super(Routes, self).route(method, path, **kwargs)(handler)
                return handler
        else:
            _route_decorator = super(Routes, self).route(method, path, **kwargs)

        return _route_decorator


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
