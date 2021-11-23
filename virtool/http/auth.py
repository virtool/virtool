from typing import Callable, Tuple

import aiofiles
import jinja2
from aiohttp import BasicAuth
from aiohttp import web
from aiohttp.web import Request, Response, HTTPFound
from aiohttp.web_exceptions import HTTPUnauthorized
from jose import ExpiredSignatureError
from jose.exceptions import JWTClaimsError, JWTError

import virtool.errors
import virtool.utils
from virtool.http.client import UserClient
from virtool.http.utils import set_session_id_cookie
from virtool.oidc.utils import validate_token, update_jwk_args
from virtool.users.db import B2CUserAttributes, find_or_create_b2c_user
from virtool.users.sessions import get_session, create_session, clear_reset_code
from virtool.utils import random_alphanumeric

AUTHORIZATION_PROJECTION = [
    "user",
    "administrator",
    "groups",
    "permissions"
]

PUBLIC_ROUTES = [
    "/api/oidc/acquire_tokens",
    "/api/oidc/refresh_tokens",
    "/api/oidc/delete_tokens",
    "/api/account/login",
    "/api/account/logout"
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


async def authenticate_with_key(req: Request, handler: Callable) -> Response:
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


async def authenticate_with_api_key(req: Request, handler: Callable, user_id: str, key: str) -> Response:
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


async def authenticate_with_b2c(req: Request, handler: Callable) -> Response:
    """
    Authenticate requests when req.app["config"].use_b2c is True.

    If no id_token cookie is attached to request, redirect to /api/acquire_tokens

    If id_token cookie is found, attempt to validate to gather user information from claims. If token is expired,
    redirect to /api/refresh_tokens. If token is invalid for some other reason, redirect to /api/delete_tokens

    find or create user based on token claims, then populate req["cient"] with user information and return the
    response from the handler.

    :param req: the request to handle
    :param handler: the handler to call with the request if it is authenticated successfully

    :return: the response
    """
    if req.cookies.get("id_token") is None:
        auth_code_flow = await req.app["run_in_thread"](
            req.app["b2c"].msal.initiate_auth_code_flow,
            ["email"],
            f"http://localhost:9950/api/oidc/acquire_tokens",
            random_alphanumeric(8)
        )
        req.app["b2c"].auth_code_flow = auth_code_flow
        return HTTPFound(auth_code_flow["auth_uri"])

    try:
        token_claims = await validate_token(req.app, req.cookies.get("id_token"))
    except ExpiredSignatureError:
        return HTTPFound("/api/oidc/refresh_tokens")
    except (JWTClaimsError, JWTError):
        await update_jwk_args(req.app, req.cookies.get("id_token"))
        return HTTPFound("/api/oidc/delete_tokens")

    user_attributes = B2CUserAttributes(
        display_name=token_claims["name"],
        given_name=token_claims["given_name"],
        family_name=token_claims["family_name"],
        oid=token_claims["oid"]
    )

    user_document = await find_or_create_b2c_user(req.app["db"], user_attributes)

    req["client"] = UserClient(
        db=req.app["db"],
        administrator=user_document["administrator"],
        force_reset=False,
        groups=user_document["groups"],
        permissions=user_document["permissions"],
        user_id=user_document["_id"],
        authenticated=True
    )

    return await handler(req)


@web.middleware
async def middleware(req, handler) -> Response:
    """
    Handle requests based on client type and authentication status.

    :param req: the request to handle
    :param handler: the handler to call with the request if it is authenticated successfully
    :return: the response
    """
    db = req.app["db"]

    if req.path in PUBLIC_ROUTES:
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

    if req.app["config"].use_b2c:
        return await authenticate_with_b2c(req, handler)

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

    requires_login = not req.app["config"].use_b2c and not req["client"].authenticated

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
