"""Policies for protecting API endpoints."""

from collections.abc import Callable
from inspect import isclass
from typing import Any

from aiohttp.web import Request
from aiohttp_pydantic import PydanticView

from virtool.api.errors import APIUnauthorized
from virtool.errors import PolicyError


class DefaultRoutePolicy:
    """Any authenticated client can access the route."""

    allow_unauthenticated: bool = False
    """
    Allow unauthenticated clients to access the route that this policy applies to.

    Policies that subclass the default policy must explicitly opt-in to allowing
    unauthenticated clients to access the route.
    """

    async def check(self, req: Request, handler, client) -> None:
        """This method is a no-op for the default policy.

        A check for client authentication is built in to the policy. It can be disabled
        by setting the ``allow_authenticated`` attribute ``False``.

        Redefine this method in a subclass to build additional checks into a policy.

        """

    async def run_checks(self, req, handler, client) -> None:
        if not self.allow_unauthenticated and not client.authenticated:
            raise APIUnauthorized("Requires authorization")

        await self.check(req, handler, client)


class PublicRoutePolicy(DefaultRoutePolicy):
    """Any client can access the route."""

    allow_unauthenticated = True


def policy(route_policy: DefaultRoutePolicy | type[DefaultRoutePolicy]):
    """Apply the provided route policy to the decorated request handler."""

    def decorator(func):
        existing_policy = getattr(func, "policy", None)

        if existing_policy:
            raise PolicyError("A policy is already defined on this route")

        func.policy = route_policy

        return func

    return decorator


def get_handler_flag(handler: Callable, method: str, name: str, default: Any):
    """Given a middleware handler and flag name, return the flag value.

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
