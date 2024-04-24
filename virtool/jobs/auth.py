import os
from typing import TYPE_CHECKING

from aiohttp import BasicAuth, web
from aiohttp.web import Request

from virtool.api.client import JobClient
from virtool.api.errors import APIUnauthorized
from virtool.types import RouteHandler
from virtool.utils import hash_key

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

PUBLIC_ROUTES = [("PATCH", "/jobs")]


@web.middleware
async def middleware(request: Request, handler: RouteHandler):
    """Ensure that the request was sent as part of an active job.

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
            raise ValueError
    except KeyError:
        raise APIUnauthorized(
            "No authorization header",
            error_id="malformed_authorization_header",
        )
    except ValueError:
        raise APIUnauthorized(
            "Invalid authorization header",
            error_id="malformed_authorization_header",
        )

    mongo: "Mongo" = request.app["db"]

    job = await mongo.jobs.find_one({"_id": job_id, "key": hash_key(key)})

    if not job:
        raise APIUnauthorized(
            "Invalid authorization header",
            error_id="malformed_authorization_header",
        )

    request["client"] = JobClient(job_id)

    return await handler(request)
