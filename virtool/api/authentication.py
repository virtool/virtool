from collections.abc import Callable

from aiohttp import BasicAuth, web
from aiohttp.web import Request, Response
from structlog import get_logger

from virtool.api.client import UserClient
from virtool.api.errors import APIUnauthorized
from virtool.api.policy import (
    PublicRoutePolicy,
    get_handler_policy,
)
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.users.utils import limit_permissions

logger = get_logger("authn")


def get_ip(req: Request) -> str:
    """Get the client IP address from a request.

    Sometimes the transport is known, in which the returned IP address is
    an empty string.

    :param req: the request
    :return: the client's IP address string

    """
    if req.transport is None:
        return ""

    return req.transport.get_extra_info("peername")[0]


async def authenticate_with_api_key(
    req: Request,
    handler: Callable,
    handle: str,
    key: str,
) -> Response:
    """Authenticate the request with the provided user handle and API key."""
    log = logger.bind(handle=handle)

    try:
        user = await get_data_from_req(req).users.get_by_handle(handle)
    except ResourceNotFoundError:
        log.info("handle not found while authenticating with api key")
        APIUnauthorized.raise_invalid_authorization_header()

    if not user.active:
        log.info("specified user not active while authenticating with api key")
        APIUnauthorized.raise_invalid_authorization_header()

    key = await get_data_from_req(req).account.get_key_by_secret(user.id, key)

    if not key:
        log.info("invalid key while authenticating with api key")
        APIUnauthorized.raise_invalid_authorization_header()

    req["client"] = UserClient(
        administrator_role=user.administrator_role,
        authenticated=True,
        force_reset=False,
        groups=[group.id for group in user.groups],
        permissions=limit_permissions(user.permissions.dict(), key.permissions.dict()),
        user_id=user.id,
    )

    return await handler(req)


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
    """Handle requests based on client type and authentication status.

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
            decoded = BasicAuth.decode(req.headers.get("AUTHORIZATION"))
        except ValueError:
            raise APIUnauthorized(
                "Malformed Authorization header",
                "malformed_authorization_header",
            )

        if decoded.login.startswith("job"):
            raise APIUnauthorized(
                "Jobs cannot authenticate against this service",
                "malformed_authorization_header",
            )

        return await authenticate_with_api_key(
            req, handler, decoded.login, decoded.password
        )

    return await authenticate_with_session(req, handler)
