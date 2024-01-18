from contextlib import suppress
from typing import Callable

from aiohttp import BasicAuth, web
from aiohttp.web import Request, Response
from jose.exceptions import ExpiredSignatureError

from virtool.api.client import UserClient
from virtool.api.errors import APIUnauthorized
from virtool.api.policy import (
    get_handler_policy,
    PublicRoutePolicy,
)
from virtool.config import get_config_from_req
from virtool.data.utils import get_data_from_req
from virtool.errors import AuthError
from virtool.oidc.utils import validate_token
from virtool.users.db import B2CUserAttributes
from virtool.users.utils import limit_permissions


def get_ip(req: Request) -> str:
    """
    A convenience function for getting the client IP address from a
    :class:`~Request` object.

    :param req: the request
    :return: the client's IP address string

    """
    return req.transport.get_extra_info("peername")[0]


def decode_authorization(authorization: str) -> tuple[str, str]:
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


async def authenticate_with_api_key(
    req: Request, handler: Callable, handle: str, key: str
) -> Response:
    """Authenticate the request with the provided user handle and API key."""
    user = await get_data_from_req(req).users.get_by_handle(handle)
    key = await get_data_from_req(req).account.get_key(user.id, key)

    if not user or not user.active or not key:
        raise APIUnauthorized(
            "Invalid authorization header", error_id="invalid_authorization_header"
        )

    req["client"] = UserClient(
        administrator_role=user.administrator_role,
        authenticated=True,
        force_reset=False,
        groups=[group.id for group in user.groups],
        permissions=limit_permissions(user.permissions.dict(), key.permissions.dict()),
        user_id=user.id,
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
        raise APIUnauthorized(
            "No B2C token found in headers or cookies", error_id="no_b2c_token"
        )

    try:
        token_claims = await validate_token(req.app, token)
    except ExpiredSignatureError:
        raise APIUnauthorized()

    user = await get_data_from_req(req).users.find_or_create_b2c_user(
        B2CUserAttributes(
            display_name=token_claims["name"],
            given_name=token_claims.get("given_name", ""),
            family_name=token_claims.get("family_name", ""),
            oid=token_claims["oid"],
        )
    )

    if user.active is False:
        raise APIUnauthorized("User is deactivated", error_id="deactivated_user")

    req["client"] = UserClient(
        administrator_role=user.administrator_role,
        authenticated=True,
        force_reset=False,
        groups=[group.id for group in user.groups],
        permissions=user.permissions.dict(),
        user_id=user.id,
        session_id=None,
    )

    resp = await handler(req)
    resp.set_cookie("bearer", token, httponly=True, max_age=2600000)

    return resp


async def authenticate_with_session(req: Request, handler: Callable) -> Response:
    """Authenticate the given request with session information in the cookie."""
    session = req["session"]

    if not session.authentication:
        raise APIUnauthorized("Requires authorization")

    user = await get_data_from_req(req).users.get(session.authentication.user_id)

    if not user.active:
        raise APIUnauthorized("User is deactivated", error_id="deactivated_user")

    req["client"] = UserClient(
        administrator_role=user.administrator_role,
        authenticated=True,
        force_reset=user.force_reset,
        groups=[group.id for group in user.groups],
        permissions=user.permissions.dict(),
        user_id=user.id,
        session_id=session.id,
    )

    resp = await handler(req)

    return resp


@web.middleware
async def authentication_middleware(req: Request, handler) -> Response:
    """
    Handle requests based on client type and authentication status.

    :param req: the request to handle
    :param handler: the handler to call with the request if authenticated
    :return: the response
    """
    if isinstance(get_handler_policy(handler, req.method), PublicRoutePolicy):
        req["client"] = UserClient(
            administrator_role=None,
            authenticated=False,
            force_reset=False,
            groups=[],
            permissions={},
            user_id=None,
            session_id=req["session"].id,
        )

        return await handler(req)

    if req.headers.get("AUTHORIZATION"):
        # Authenticate the request with an API key or job key.
        try:
            holder_id, key = decode_authorization(req.headers.get("AUTHORIZATION"))
        except AuthError:
            raise APIUnauthorized(
                "Malformed Authorization header", "malformed_authorization_header"
            )

        if holder_id.startswith("job"):
            raise APIUnauthorized(
                "Jobs cannot authenticate against this service",
                "malformed_authorization_header",
            )

        return await authenticate_with_api_key(req, handler, holder_id, key)

    if get_config_from_req(req).use_b2c:
        with suppress(APIUnauthorized):
            return await authenticate_with_b2c(req, handler)

    return await authenticate_with_session(req, handler)
