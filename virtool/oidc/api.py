from urllib.parse import parse_qs

import jwt
from aiohttp.web import Request, Response
from aiohttp.web_exceptions import HTTPFound

from virtool.http.policy import PublicRoutePolicy, policy
from virtool.http.routes import Routes
from virtool.utils import run_in_thread

routes = Routes()


@routes.get("/oidc/acquire_tokens")
@policy(PublicRoutePolicy)
async def acquire_tokens(req: Request) -> Response:
    """
    Gather authentication response from auth uri query string.
    Fetch tokens from b2c authorization endpoint.

    Once tokens are acquired, redirect user back to Virtool homepage.

    If error occurs during token retrieval, delete tokens to restart process.

    """
    auth_response = {
        key: value[0] for key, value in parse_qs(req.url.query_string).items()
    }

    try:
        result = await run_in_thread(
            req.app["b2c"].msal.acquire_token_by_auth_code_flow,
            req.app["b2c"].auth_code_flow,
            auth_response,
        )
    except ValueError:
        return HTTPFound("/oidc/delete_tokens")

    resp = HTTPFound("/")

    if "id_token" in result:
        resp.set_cookie("id_token", result.get("id_token"), httponly=True)

    return resp


@routes.get("/oidc/refresh_tokens")
@policy(PublicRoutePolicy)
async def refresh_tokens(req: Request) -> Response:
    """
    Silently retrieve tokens for account in token cache.

    Fetch oid value stored in expired ID token, then fetch fresh
    tokens from token cache for the account with the correct
    local account ID value.

    If no accounts are found, or correct account isn't found,
    then redirect to /delete_tokens

    """
    accounts = req.app["b2c"].msal.get_accounts()

    if accounts:
        # decode token without validation to fetch oid value
        payload = jwt.decode(
            req.cookies.get("id_token"), options={"verify_signature": False}
        )

        user_account = [
            account
            for account in accounts
            if payload["oid"] == account["local_account_id"]
        ][0]

        if user_account:
            result = await run_in_thread(
                req.app["b2c"].msal.acquire_token_silent,
                [],
                user_account,
                req.app["b2c"].authority,
            )

            if "id_token" in result:
                resp = HTTPFound("/")
                resp.set_cookie("id_token", result.get("id_token"), httponly=True)
                return resp

    return HTTPFound("/oidc/delete_tokens")


@routes.get("/oidc/delete_tokens")
@policy(PublicRoutePolicy)
async def delete_tokens(req: Request) -> Response:
    """
    Delete id_token cookie from response.

    """
    resp = HTTPFound("/")
    resp.del_cookie("id_token")
    return resp
