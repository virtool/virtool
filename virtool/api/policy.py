"""Policies for protecting API endpoints."""

from collections.abc import Callable
from inspect import isclass

from aiohttp_pydantic import PydanticView

from virtool.errors import PolicyError


class DefaultRoutePolicy:
    """Only authenticated clients can access the route.

    This policy applies to any route that doesn't declare one with :func:`.policy`.
    """


class PublicRoutePolicy(DefaultRoutePolicy):
    """Any client can access the route."""


def policy(route_policy: DefaultRoutePolicy | type[DefaultRoutePolicy]):
    """Apply the provided route policy to the decorated request handler."""

    def decorator(func):
        existing_policy = getattr(func, "policy", None)

        if existing_policy:
            raise PolicyError("A policy is already defined on this route")

        func.policy = route_policy

        return func

    return decorator


def get_handler_policy(handler: Callable, method: str) -> DefaultRoutePolicy:
    """Return the policy that applies to a request handler.

    The jobs API serves two shapes of handler: plain request handler functions and
    :class:`PydanticView` subclasses, where the policy is declared on the method that
    matches the request method. Both shapes must resolve here. If they don't, protected
    routes become public or live workflows start getting rejected.

    :param handler: the handler the request resolved to
    :param method: the HTTP method of the request
    :return: the policy for the handler
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

    cls_or_obj = getattr(h, "policy", DefaultRoutePolicy)

    if isclass(cls_or_obj):
        return cls_or_obj()

    return cls_or_obj
