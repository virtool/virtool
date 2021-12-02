import os

from aiohttp import BasicAuth, web
from aiohttp.web import Request
from aiohttp.web_exceptions import HTTPUnauthorized
from virtool.http.client import JobClient
from virtool.jobs.utils import JobRights
from virtool.types import RouteHandler
from virtool.utils import hash_key

PUBLIC_ROUTES = [("PATCH", "/jobs")]


@web.middleware
async def middleware(request: Request, handler: RouteHandler):
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
        basic_auth = BasicAuth.decode(auth_header)
        holder_id, key = basic_auth.login, basic_auth.password

        job_prefix, job_id = holder_id.split("-")
        if job_prefix != "job":
            raise ValueError()
    except KeyError:
        raise HTTPUnauthorized(text="No authorization header.")
    except ValueError:
        raise HTTPUnauthorized(text="Invalid authorization header.")

    db = request.app["db"]

    job = await db.jobs.find_one({"_id": job_id, "key": hash_key(key)})

    if not job:
        raise HTTPUnauthorized(text="Invalid authorization header.")

    try:
        rights = job["rights"]
    except KeyError:
        rights = None

    request["client"] = JobClient(
        job_id,
        JobRights(rights)
    )

    return await handler(request)
