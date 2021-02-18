import os
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
async def middleware(request: aiohttp.web.Request, handler: RouteHandler):
    """
    Ensure that the request was sent as part of an active job.

    Uses HTTP basic access authentication, where the authorization header format is:

        Authorization: Basic job-{job_id}:{key}

    Sends status codes:

    *401 NOT AUTHORIZED*
        When the `Authorization` header is invalid, or missing.
    """
    if (request.method, os.path.split(request.path)[0]) in PUBLIC_ROUTES:
        return await handler(request)

    try:
        auth_header = request.headers["AUTHORIZATION"]
        basic_auth = aiohttp.BasicAuth.decode(auth_header)
        holder_id, key = basic_auth.login, basic_auth.password

        job_prefix, job_id = holder_id.split("-")
        if job_prefix != "job":
            raise ValueError()
    except KeyError:
        return unauthorized("No authorization header.")
    except ValueError as value_error:
        return unauthorized("Invalid authorization header.")

    db = request.app["db"]

    job = await db.jobs.find_one({"_id": job_id, "key": hash_key(key)})

    if not job:
        return unauthorized("Invalid authorization header.")

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
