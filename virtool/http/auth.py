import os
from typing import Callable, Tuple

import aiofiles
import aiohttp
import jinja2
from aiohttp import web

import virtool.db.utils
import virtool.errors
import virtool.http.utils
import virtool.routes
import virtool.templates
import virtool.users.db
import virtool.users.sessions
import virtool.users.utils
import virtool.utils
from virtool.api.response import unauthorized
from virtool.db.utils import get_one_field
from virtool.http.client import JobClient, UserClient
from virtool.jobs.utils import JobRights
from virtool.utils import hash_key

AUTHORIZATION_PROJECTION = [
    "user",
    "administrator",
    "groups",
    "permissions"
]


def can_use_key(req: web.Request) -> bool:
    """
    Check if the passed :class:`.Request` object can be authenticated using an API key.

    :param req: the request to check
    :return: can the request be authenticated with an API key

    """
    path = req.path
    enable_api = req.app["settings"]["enable_api"]

    return (path.startswith("/api") or path.startswith("/download")) and enable_api


def get_ip(req: web.Request) -> str:
    """
    A convenience function for getting the client IP address from a :class:`~web.Request` object.

    :param req: the request
    :return: the client's IP address string

    """
    return req.transport.get_extra_info("peername")[0]


def decode_authorization(authorization: str) -> Tuple[str, str]:
    """
    Parse and decode an API key from an HTTP authorization header value.

    :param authorization: the authorization header value for a API request
    :return: a tuple containing the user id and API key parsed from the authorization header

    """
    try:
        auth: aiohttp.BasicAuth = aiohttp.BasicAuth.decode(authorization)
    except ValueError as error:
        raise virtool.errors.AuthError(str(error))

    return auth.login, auth.password


async def authenticate_with_key(req: web.Request, handler: Callable):
    """
    Authenticate the request with an API key or job key.

    :param req: the request to authenticate
    :param handler: the handler to call with the request if it is authenticated successfully

    """
    try:
        holder_id, key = decode_authorization(req.headers.get("AUTHORIZATION"))
    except virtool.errors.AuthError:
        return unauthorized("Malformed Authorization header")

    return await authenticate_with_api_key(req, handler, holder_id, key)


async def authenticate_with_api_key(req, handler, user_id: str, key: str):
    db = req.app["db"]

    document = await db.keys.find_one({
        "_id": virtool.utils.hash_key(key),
        "user.id": user_id
    }, AUTHORIZATION_PROJECTION)

    if not document:
        return unauthorized("Invalid authorization header")

    req["client"] = UserClient(
        db,
        get_ip(req),
        document["administrator"],
        document["force_reset"],
        document["groups"],
        document["permissions"],
        user_id
    )

    return await handler(req)


async def authenticate_with_job_key(req: web.Request, handler: Callable, job_id: str, key: str):
    """
    Authenticate the request with a job ID and secure key.

    :param req: the request to authenticate
    :param handler: the handler to call the request with when authentication succeeds
    :param job_id: the job to authenticate against
    :param key: the job key to authenticate with

    """
    db = req.app["db"]

    document = await db.jobs.find_one({
        "_id": job_id,
        "key": hash_key(key)
    })

    if not document:
        return unauthorized("Invalid authorization header")

    rights = await get_one_field(db.jobs, "rights", job_id)

    req["client"] = JobClient(
        get_ip(req),
        job_id,
        JobRights(rights)
    )

    return await handler(req)


@web.middleware
async def middleware(req, handler):
    db = req.app["db"]

    if req.path == "/api/account/login" or req.path == "/api/account/logout":
        req["client"] = None
        return await handler(req)

    if req.headers.get("AUTHORIZATION"):
        if can_use_key(req):
            return await authenticate_with_key(req, handler)

    # Get session information from cookies.
    session_id = req.cookies.get("session_id")
    session_token = req.cookies.get("session_token")

    session, session_token = await virtool.users.sessions.get_session(
        db,
        session_id,
        session_token
    )

    ip = get_ip(req)

    if session is None:
        session, session_token = await virtool.users.sessions.create_session(db, ip)

    session_id = session["_id"]

    if session_token:
        req["client"] = UserClient(
            db,
            ip,
            session["administrator"],
            session["force_reset"],
            session["groups"],
            session["permissions"],
            session["user"]["id"],
            session_id
        )
    else:
        req["client"] = None

    resp = await handler(req)

    if req.path != "/api/account/reset":
        await virtool.users.sessions.clear_reset_code(db, session["_id"])

    virtool.http.utils.set_session_id_cookie(resp, session_id)

    if req.path == "/api/":
        resp.del_cookie("session_token")

    return resp


async def index_handler(req: web.Request) -> web.Response:
    """
    A request handler for requests where the `index.html` should be returned.

    :param req: the request to handle
    :return: the response

    """
    requires_first_user = not await req.app["db"].users.count_documents({})

    requires_login = req["client"] is None

    path = os.path.join(req.app["client_path"], "index.html")

    async with aiofiles.open(path, "r") as f:
        template = jinja2.Template(await f.read(), autoescape=True)

    html = template.render(
        dev=req.app["settings"]["dev"],
        first=requires_first_user,
        login=requires_login,
        nonce=req["nonce"],
        version=req.app["version"]
    )

    return web.Response(body=html, content_type="text/html")
