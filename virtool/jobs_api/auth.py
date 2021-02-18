from typing import Callable, Awaitable

import aiohttp.web

from virtool.api.response import unauthorized
from virtool.http.auth import get_ip
from virtool.http.client import JobClient
from virtool.jobs.utils import JobRights
from virtool.utils import hash_key

RouteHandler = Callable[[aiohttp.web.Request], Awaitable[aiohttp.web.Response]]

PUBLIC_ROUTES = [("PATCH", "/api/jobs")]


@aiohttp.web.middleware
def job_authentication(request: aiohttp.web.Request, handler: RouteHandler):
    """Ensure that the request was sent as part of an active job."""
    if (request.method, request.path) in PUBLIC_ROUTES:
        return await handler(request)

    try:
        auth_header = request.headers["AUTHORIZATION"]
        job_id, key = aiohttp.BasicAuth.decode(auth_header)
    except KeyError:
        return unauthorized("No authorization header.")

    db = request.app["db"]

    job = await db.jobs.find_one({"_id": job_id, "key": hash_key(key)})

    if not job:
        return unauthorized(f"Invalid authorization header.")

    try:
        rights = job["rights"]
    except KeyError:
        rights = None

    request["client"] = JobClient(
        get_ip(request),
        job_id,
        JobRights(rights)
    )

    return await handler(request)
