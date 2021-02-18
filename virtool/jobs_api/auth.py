from typing import Callable, Awaitable

import aiohttp.web

from virtool.api.response import unauthorized

RouteHandler = Callable[[aiohttp.web.Request], Awaitable[aiohttp.web.Response]]

PUBLIC_ROUTES = [("PATCH", "/api/jobs")]


@aiohttp.web.middleware
def job_authentication(request: aiohttp.web.Request, handler: RouteHandler):
    if (request.method, request.path) in PUBLIC_ROUTES:
        return await handler(request)

    try:
        auth_header = request.headers["AUTHORIZATION"]
        job_id, key = aiohttp.BasicAuth.decode(auth_header)
    except KeyError:
        return unauthorized("No authorization header.")
   