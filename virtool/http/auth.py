from typing import Callable, Tuple

import aiofiles
import jinja2
from aiohttp import BasicAuth
from aiohttp import web
from aiohttp.web import Request, Response
from aiohttp.web_exceptions import HTTPUnauthorized

import virtool.errors
from virtool.http.client import UserClient
from virtool.http.utils import set_session_id_cookie
from virtool.users.sessions import get_session, create_session, clear_reset_code
from virtool.utils import hash_key

AUTHORIZATION_PROJECTION = [
    "user",
    "administrator",
    "groups",
    "permissions"
]


def can_use_key(req: Request) -> bool:
    """
    Check if the passed :class:`.Request` object can be authenticated using an API key.

    :param req: the request to check
    :return: can the request be authenticated with an API key

    """
    path = req.path
    enable_api = req.app["settings"].enable_api

    return (path.startswith("/api") or path.startswith("/download")) and enable_api


def get_ip(req: Request) -> str:
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
        auth: BasicAuth = BasicAuth.decode(authorization)
    except ValueError as error:
        raise virtool.errors.AuthError(str(error))

    return auth.login, auth.password


async def authenticate_with_key(req: Request, handler: Callable):
    """
    Authenticate the request with an API key or job key.

    :param req: the request to authenticate
    :param handler: the handler to call with the request if it is authenticated successfully

    """
    try:
        holder_id, key = decode_authorization(req.headers.get("AUTHORIZATION"))
    except virtool.errors.AuthError:
        raise HTTPUnauthorized(text="Malformed Authorization header")

    return await authenticate_with_api_key(req, handler, holder_id, key)


async def authenticate_with_api_key(req: Request, handler: Callable, user_id: str, key: str):
    db = req.app["db"]

    document = await db.keys.find_one({
        "_id": virtool.utils.hash_key(key),
        "user.id": user_id
    }, AUTHORIZATION_PROJECTION)

    if not document:
        raise HTTPUnauthorized(text="Invalid authorization header")

    req["client"] = UserClient(
        db=db,
        administrator=document["administrator"],
        force_reset=document["force_reset"],
        groups=document["groups"],
        permissions=document["permissions"],
        user_id=user_id,
        authenticated=True
    )

    return await handler(req)


@web.middleware
async def middleware(req, handler):
    db = req.app["db"]

    if req.path == "/api/account/login" or req.path == "/api/account/logout":
        req["client"] = UserClient(
            db=db,
            administrator=False,
            force_reset=False,
            groups=list(),
            permissions=dict(),
            user_id=None,
            authenticated=False
        )

        return await handler(req)

    if req.headers.get("AUTHORIZATION"):
        if can_use_key(req):
            return await authenticate_with_key(req, handler)

    # Get session information from cookies.
    session_id = req.cookies.get("session_id")
    session_token = req.cookies.get("session_token")

    session, session_token = await get_session(
        db,
        session_id,
        session_token
    )

    ip = get_ip(req)

    if session is None:
        session, session_token = await create_session(db, ip)

    session_id = session["_id"]

    if session_token:
        req["client"] = UserClient(
            db,
            session["administrator"],
            session["force_reset"],
            session["groups"],
            session["permissions"],
            session["user"]["id"],
            authenticated=True,
            session_id=session_id
        )

    else:
        req["client"] = UserClient(
            db=db,
            administrator=False,
            force_reset=False,
            groups=list(),
            permissions=dict(),
            user_id=None,
            authenticated=False,
        )

    resp = await handler(req)

    if req.path != "/api/account/reset":
        await clear_reset_code(db, session["_id"])

    set_session_id_cookie(resp, session_id)

    if req.path == "/api/":
        resp.del_cookie("session_token")

    return resp


async def index_handler(req: Request) -> Response:
    """
    A request handler for requests where the `index.html` should be returned.

    :param req: the request to handle
    :return: the response

    """
    requires_first_user = not await req.app["db"].users.count_documents({})

    requires_login = req["client"].authenticated is False

    path = req.app["client_path"] / "index.html"

    async with aiofiles.open(path, "r") as f:
        template = jinja2.Template(await f.read(), autoescape=True)

    html = template.render(
        dev=req.app["config"].dev,
        first=requires_first_user,
        login=requires_login,
        nonce=req["nonce"],
        version=req.app["version"]
    )

    return Response(body=html, content_type="text/html")
