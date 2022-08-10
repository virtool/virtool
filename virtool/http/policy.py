from inspect import isclass
from logging import getLogger
from typing import Callable, Any, Type, Union

from aiohttp import web
from aiohttp.web import Request
from aiohttp.web_exceptions import HTTPUnauthorized, HTTPForbidden
from aiohttp_pydantic import PydanticView
from virtool_core.models.enums import Permission

from virtool.errors import PolicyError
from virtool.http.client import AbstractClient, UserClient, JobClient

logger = getLogger(__name__)


class DefaultRoutePolicy:
    """Any authenticated client can access the route."""

    allow_unauthenticated = False

    def check(self, req, handler, client):
        """
        This method is a no-op for the default policy.

        A check for client authentication is built in to the policy. It can be disabled
        by setting the ``allow_authenticated`` attribute ``False``.

        Redefine this method in a subclass to build additional checks into a policy.

        """
        ...

    def run_checks(self, req, handler, client):
        if not self.allow_unauthenticated and not client.authenticated:
            raise HTTPUnauthorized(text="Requires authorization")

        self.check(req, handler, client)


class AdministratorRoutePolicy(DefaultRoutePolicy):
    """Only authenticated clients that are administrators can access the route."""

    def check(self, req, handler, client: AbstractClient):
        if not client.administrator:
            raise HTTPForbidden(text="Requires administrative privilege")


class PermissionsRoutePolicy(DefaultRoutePolicy):
    """Only authenticated clients with the set permissions can access the route."""

    def __init__(self, *permissions: Permission):
        self.permissions = permissions

    def check(self, req, handler, client: Union[UserClient, JobClient]):
        if client.administrator:
            # Administrators bypass permission checks.
            return

        for permission in self.permissions:
            if not client.permissions[permission.name]:
                raise HTTPForbidden(text="Not permitted")


class PublicRoutePolicy(DefaultRoutePolicy):
    """Any client can access the route."""

    allow_unauthenticated = True


def policy(route_policy: Union[DefaultRoutePolicy, Type[DefaultRoutePolicy]]):
    def decorator(func):
        try:
            if func.policy:
                raise PolicyError("A policy is already defined on this route")
        except AttributeError:
            func.policy = route_policy
            return func

    return decorator


def get_handler_flag(handler: Callable, method: str, name: str, default: Any):
    """
    Given a middleware handler and flag name, return the flag value.

    Returns ``None`` if the flag doesn't exist unless a ``default`` value is set.

    :param handler: the handler
    :param name: the flag attribute name
    :param method: the http method being used
    :param default: an optional default value to return if no flag is found
    :return: the flag value
    """
    depth = 0
    h = handler

    while depth < 100:
        try:
            h = h.__wrapped__
        except AttributeError:
            break

        depth += 1

    if isclass(h) and issubclass(h, PydanticView):
        method_name = method.lower()
        view = h(None)

        try:
            h = getattr(view, method_name)
        except AttributeError:
            raise AttributeError(f"No such method on view: {method_name}")

    try:
        return getattr(h, name)
    except AttributeError:
        return default


def get_handler_policy(handler: Callable, method: str) -> DefaultRoutePolicy:
    cls_or_obj = get_handler_flag(handler, method, "policy", DefaultRoutePolicy())

    if isclass(cls_or_obj):
        return cls_or_obj()

    return cls_or_obj


@web.middleware
async def route_policy_middleware(req: Request, handler: Callable):
    """
    Apply route policies to incoming requests.

    Policy check methods must raise aiohttp HTTP exceptions to interrupt the request.
    The default policy rejects any requests from unauthenticated clients.

    """
    route_policy = get_handler_policy(handler, req.method)
    route_policy.run_checks(req, handler, req["client"])

    return await handler(req)
