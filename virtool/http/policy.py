from inspect import isclass
from logging import getLogger
from typing import Callable, Any, Type, Union

from aiohttp import web
from aiohttp.web import Request
from aiohttp.web_exceptions import HTTPUnauthorized, HTTPForbidden
from aiohttp_pydantic import PydanticView

from virtool.authorization.permissions import (
    ResourceType,
    LegacyPermission,
)
from virtool.authorization.roles import (
    AdministratorRole,
)
from virtool.authorization.utils import get_authorization_client_from_req
from virtool.errors import PolicyError
from virtool.http.client import AbstractClient

logger = getLogger(__name__)


class DefaultRoutePolicy:
    """Any authenticated client can access the route."""

    allow_unauthenticated: bool = False
    """
    Allow unauthenticated clients to access the route that this policy applies to.

    Policies that subclass the default policy must explicitly opt-in to allowing
    unauthenticated clients to access the route.
    """

    async def check(self, req: Request, handler, client):
        """
        This method is a no-op for the default policy.

        A check for client authentication is built in to the policy. It can be disabled
        by setting the ``allow_authenticated`` attribute ``False``.

        Redefine this method in a subclass to build additional checks into a policy.

        """
        ...

    async def run_checks(self, req, handler, client):
        if not self.allow_unauthenticated and not client.authenticated:
            raise HTTPUnauthorized(text="Requires authorization")

        await self.check(req, handler, client)


class AdministratorRoutePolicy(DefaultRoutePolicy):
    """Only authenticated clients that are administrators can access the route."""

    def __init__(self, role: AdministratorRole):
        self.role = role

    async def check(self, req, handler, client: AbstractClient):
        if client.administrator:
            return

        if await get_authorization_client_from_req(req).check(
            client.user_id, self.role, ResourceType.APP, "virtool"
        ):
            return

        raise HTTPForbidden(text="Requires administrative privilege")


class PermissionRoutePolicy(DefaultRoutePolicy):
    def __init__(self, permission: LegacyPermission):
        self.permission = permission

    async def check(self, req: Request, handler: Callable, client):
        """
        Checks if the client has the required permission for the object.

        Raises ``HTTPForbidden`` if the client does not have the required permission.

        The check will pass if:
        * The user is an administrator.
        * The user has the required permission in their legacy MongoDB-based
          permissions.

        """
        if client.administrator or client.permissions[self.permission.value]:
            return

        raise HTTPForbidden(text="Not permitted")


class PublicRoutePolicy(DefaultRoutePolicy):
    """Any client can access the route."""

    allow_unauthenticated = True


class WebSocketRoutePolicy(DefaultRoutePolicy):
    """Only for use with websocket, accessible by any client"""

    allow_unauthenticated = True


def policy(route_policy: Union[DefaultRoutePolicy, Type[DefaultRoutePolicy]]):
    """
    Applies the provided route policy to the decorated request handler.

    """

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
    await route_policy.run_checks(req, handler, req["client"])

    return await handler(req)
