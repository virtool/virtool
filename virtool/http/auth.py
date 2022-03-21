from typing import Callable, Tuple

from aiohttp import BasicAuth, web
from aiohttp.web import Request, Response
from aiohttp.web_exceptions import HTTPUnauthorized
from jose import ExpiredSignatureError
from jose.exceptions import JWTClaimsError, JWTError

from virtool.errors import AuthError
from virtool.http.client import UserClient
from virtool.http.utils import set_session_id_cookie
from virtool.oidc.utils import validate_token
from virtool.users.db import B2CUserAttributes, find_or_create_b2c_user
from virtool.users.sessions import clear_reset_code, create_session, get_session
from virtool.utils import hash_key

AUTHORIZATION_PROJECTION = ["user", "administrator", "groups", "permissions"]

PUBLIC_ROUTES = [
    "/oidc/acquire_tokens",
    "/oidc/refresh_tokens",
    "/oidc/delete_tokens",
    "/account/login",
    "/account/logout",
]


def get_ip(req: Request) -> str:
    """
    A convenience function for getting the client IP address from a
    :class:`~Request` object.

    :param req: the request
    :return: the client's IP address string

    """
    return req.transport.get_extra_info("peername")[0]


def decode_authorization(authorization: str) -> Tuple[str, str]:
    """
    Parse and decode an API key from an HTTP authorization header value.

    :param authorization: the authorization header value for an API request
    :return: the user id and API key parsed from the authorization header

    """
    try:
        auth = BasicAuth.decode(authorization)
    except ValueError as error:
        raise AuthError(str(error))

    return auth.login, auth.password


async def authenticate_with_key(req: Request, handler: Callable) -> Response:
    """
    Authenticate the request with an API key or job key.

    :param req: the request to authenticate
    :param handler: the handler to call with the request if authenticated

    """
    try:
        holder_id, key = decode_authorization(req.headers.get("AUTHORIZATION"))
    except AuthError:
        raise HTTPUnauthorized(text="Malformed Authorization header")

    return await authenticate_with_api_key(req, handler, holder_id, key)


async def authenticate_with_api_key(
    req: Request, handler: Callable, user_id: str, key: str
) -> Response:
    db = req.app["db"]

    document = await db.keys.find_one(
        {"_id": hash_key(key), "user.id": user_id}, ["permissions"]
    )

    if not document:
        raise HTTPUnauthorized(text="Invalid authorization header")

    user = db.users.find_one({"_id": user_id}, AUTHORIZATION_PROJECTION)

    req["client"] = UserClient(
        db=db,
        administrator=user["administrator"],
        force_reset=False,
        groups=user["groups"],
        permissions=document["permissions"],
        user_id=user_id,
        authenticated=True,
    )

    return await handler(req)


async def authenticate_with_b2c(req: Request, handler: Callable) -> Response:
    """
    Authenticate requests when req.app["config"].use_b2c is True.

    If no id_token cookie is attached to request, redirect to /acquire_tokens

    If id_token cookie is found, attempt to validate to gather user information from
    claims. If token is expired, redirect to /refresh_tokens. If token is invalid for
    some other reason, redirect to /delete_tokens

    find or create user based on token claims, then populate req["cient"] with user
    information and return the response from the handler.

    :param req: the request to handle
    :param handler: the handler to call with the request if authenticated
    :return: the response
    """
    token = req.headers.get("bearer") or req.cookies.get("bearer")

    if token is None:
        raise HTTPUnauthorized(text="Invalid authorization")

    try:
        token_claims = await validate_token(req.app, token)
    except (JWTClaimsError, JWTError, ExpiredSignatureError):
        raise HTTPUnauthorized(text="Invalid authorization")

    user_attributes = B2CUserAttributes(
        display_name=token_claims["name"],
        given_name=token_claims.get("given_name", ""),
        family_name=token_claims.get("family_name", ""),
        oid=token_claims["oid"],
    )

    user_document = await find_or_create_b2c_user(req.app["db"], user_attributes)

    req["client"] = UserClient(
        db=req.app["db"],
        administrator=user_document["administrator"],
        force_reset=False,
        groups=user_document["groups"],
        permissions=user_document["permissions"],
        user_id=user_document["_id"],
        authenticated=True,
    )

    resp = await handler(req)

    resp.set_cookie("bearer", token, httponly=True, max_age=2600000)

    return resp


@web.middleware
async def middleware(req, handler) -> Response:
    """
    Handle requests based on client type and authentication status.

    :param req: the request to handle
    :param handler: the handler to call with the request if authenticated
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
            authenticated=False,
        )

        return await handler(req)

    if req.headers.get("AUTHORIZATION"):
        return await authenticate_with_key(req, handler)

    if req.app["config"].use_b2c:
        try:
            return await authenticate_with_b2c(req, handler)
        except HTTPUnauthorized:
            # Allow authentication by both session and JWT in same instance.
            pass

    # Get session information from cookies.
    session_id = req.cookies.get("session_id")
    session_token = req.cookies.get("session_token")

    session, session_token = await get_session(db, session_id, session_token)

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
            session_id=session_id,
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

    if req.path != "/account/reset":
        await clear_reset_code(db, session["_id"])

    set_session_id_cookie(resp, session_id)

    return resp
