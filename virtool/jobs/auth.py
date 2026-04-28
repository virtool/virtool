from aiohttp import BasicAuth, web
from aiohttp.web import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.api.client import JobClient
from virtool.api.errors import APIUnauthorized
from virtool.api.policy import PublicRoutePolicy, get_handler_policy
from virtool.jobs.models import TERMINAL_JOB_STATES
from virtool.jobs.pg import SQLJob
from virtool.types import RouteHandler
from virtool.utils import hash_key

TERMINAL_STATES = {s.value for s in TERMINAL_JOB_STATES}


@web.middleware
async def middleware(request: Request, handler: RouteHandler):
    """Ensure that the request was sent as part of an active job.

    Uses HTTP basic access authentication, where the authorization header format is:

        Authorization: Basic job-{job_id}:{key}

    Sends status codes:

    *401 NOT AUTHORIZED*
        When the `Authorization` header is invalid, or missing.
    """
    if isinstance(get_handler_policy(handler, request.method), PublicRoutePolicy):
        return await handler(request)

    try:
        auth_header = request.headers["AUTHORIZATION"]
        basic_auth = BasicAuth.decode(auth_header)
        holder_id, key = basic_auth.login, basic_auth.password

        job_prefix, raw_job_id = holder_id.split("-")
        if job_prefix != "job":
            raise ValueError

        job_id = int(raw_job_id)
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

    async with AsyncSession(request.app["pg"]) as session:
        result = await session.execute(
            select(SQLJob).where(SQLJob.id == job_id),
        )
        sql_job = result.scalar()

    if not sql_job or sql_job.key != hash_key(key):
        raise APIUnauthorized(
            "Invalid authorization header",
            error_id="malformed_authorization_header",
        )

    if sql_job.state in TERMINAL_STATES:
        raise APIUnauthorized(
            "Job is no longer active",
            error_id="malformed_authorization_header",
        )

    request["client"] = JobClient(job_id)

    return await handler(request)
