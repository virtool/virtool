from aiohttp import BasicAuth, web
from aiohttp.web import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.api.client import JobClient
from virtool.api.errors import APIUnauthorized
from virtool.api.policy import PublicRoutePolicy, get_handler_policy
from virtool.jobs.models import TERMINAL_JOB_STATES
from virtool.jobs.pg import SQLJob
from virtool.jobs.utils import get_latest_status
from virtool.mongo.utils import get_mongo_from_req
from virtool.types import RouteHandler
from virtool.utils import hash_key

TERMINAL_V2_STATES = {"cancelled", "failed", "succeeded"}


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

    if job_id.isdigit():
        return await _authenticate_v2_job(request, handler, job_id, key)

    job = await get_mongo_from_req(request).jobs.find_one(
        {"_id": job_id, "key": hash_key(key)}
    )

    if not job:
        raise APIUnauthorized(
            "Invalid authorization header",
            error_id="malformed_authorization_header",
        )

    # Check if job is in a terminal state
    latest_status = get_latest_status(job)
    if latest_status and latest_status.state in TERMINAL_JOB_STATES:
        raise APIUnauthorized(
            "Job is no longer active",
            error_id="malformed_authorization_header",
        )

    request["client"] = JobClient(job_id)

    return await handler(request)


async def _authenticate_v2_job(
    request: Request, handler: RouteHandler, job_id: str, key: str
):
    """Authenticate a V2 (Postgres) job by its numeric ID and key."""
    async with AsyncSession(request.app["pg"]) as session:
        result = await session.execute(
            select(SQLJob).where(SQLJob.id == int(job_id)),
        )
        sql_job = result.scalar()

    if not sql_job or sql_job.key != hash_key(key):
        raise APIUnauthorized(
            "Invalid authorization header",
            error_id="malformed_authorization_header",
        )

    if sql_job.state in TERMINAL_V2_STATES:
        raise APIUnauthorized(
            "Job is no longer active",
            error_id="malformed_authorization_header",
        )

    request["client"] = JobClient(job_id)

    return await handler(request)
