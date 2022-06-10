from functools import wraps
from typing import Callable

from aiohttp.web_exceptions import HTTPUnauthorized
from aiohttp.web import Request
from aiohttp import web

from virtool.api.response import json_response
from virtool.http.auth import PUBLIC_ROUTES
from virtool.users.utils import PERMISSIONS


def admin(func):
    @wraps(func)
    async def wrapper(view, *args, **kwargs):
        view.request.admin = True

        return await func(view, *args, **kwargs)

    return wrapper


def permissions(*active):
    def decorator(func):
        @wraps(func)
        async def wrapper(view, *args, **kwargs):
            view.request.permissions = active
            return await func(view, *args, **kwargs)

        return wrapper

    return decorator


def public(func):
    @wraps(func)
    async def wrapper(view, *args, **kwargs):
        view.request.public = True

        return await func(view, *args, **kwargs)

    return wrapper


@web.middleware
async def middleware(req: Request, handler: Callable):
    """
    Handle public, admin and permission privileges.
    """

    resp = await handler(req)

    client = req["client"]

    try:
        req.public
    except AttributeError:
        if not client.authenticated and req.path not in PUBLIC_ROUTES:
            raise HTTPUnauthorized(text="Requires authorization")

    if not client.authenticated or not client.administrator:
        try:
            req.admin
            return json_response(
                {
                    "id": "not_permitted",
                    "message": "Requires administrative privilege",
                },
                status=403
            )
        except AttributeError:
            pass

        try:
            required_permissions = req.permissions
            for permission in required_permissions:
                if permission not in PERMISSIONS:
                    raise ValueError("Invalid permission: " + permission)
                if not client.permissions[permission]:
                    return json_response(
                        {"id": "not_permitted", "message": "Not permitted"}, status=403
                    )

        except AttributeError:
            pass

    return resp
