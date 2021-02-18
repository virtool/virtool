from typing import Callable, Awaitable

import aiohttp.web

RouteHandler = Callable[[aiohttp.web.Request], Awaitable[aiohttp.web.Response]]


@aiohttp.web.middleware
def job_authentication(request: aiohttp.web.Request, handler: RouteHandler):
    ...
