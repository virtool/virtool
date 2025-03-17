from asyncio import to_thread
from urllib.parse import parse_qs

import jwt
from aiohttp.web import Response
from aiohttp.web_exceptions import HTTPFound

from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R302
from virtool.api.view import APIView

routes = Routes()


@routes.web.view("/oidc/acquire_tokens")
class AcquireTokensView(APIView):
    @policy(PublicRoutePolicy)
    async def get(self) -> Response:
        """Acquire OIDC tokens.

        Fetches tokens given an authentication response from a request containing a
        authorization URI query string.

        Once tokens are acquired, the client is redirected to Virtool.
        """
        auth_response = {
            key: value[0]
            for key, value in parse_qs(self.request.url.query_string).items()
        }

        try:
            result = await to_thread(
                self.request.app["b2c"].msal.acquire_token_by_auth_code_flow,
                self.request.app["b2c"].auth_code_flow,
                auth_response,
            )
        except ValueError:
            return HTTPFound("/oidc/delete_tokens")

        resp = HTTPFound("/")

        if "id_token" in result:
            resp.set_cookie("id_token", result.get("id_token"), httponly=True)

        return resp


@routes.web.view("/oidc/refresh_tokens")
class RefreshTokensView(APIView):
    @policy(PublicRoutePolicy)
    async def get(self) -> R302:
        """Refresh OIDC tokens.

        Silently retrieves tokens for the account in the token cache.

        Fetch the OID stored in expired ID token. Then, fetch fresh tokens from token
        cache for the account with the correct local account ID value.

        The client is redirected to `/delete_tokens` if no valid accounts are found.
        """
        accounts = self.request.app["b2c"].msal.get_accounts()

        if accounts:
            # decode token without validation to fetch oid value
            payload = jwt.decode(
                self.request.cookies.get("id_token"),
                options={"verify_signature": False},
            )

            user_account = [
                account
                for account in accounts
                if payload["oid"] == account["local_account_id"]
            ][0]

            if user_account:
                result = await to_thread(
                    self.request.app["b2c"].msal.acquire_token_silent,
                    [],
                    user_account,
                    self.request.app["b2c"].authority,
                )

                if "id_token" in result:
                    resp = HTTPFound("/")
                    resp.set_cookie("id_token", result.get("id_token"), httponly=True)
                    return resp

        raise HTTPFound("/oidc/delete_tokens")


@routes.web.view("/oidc/delete_tokens")
class DeleteTokensView(APIView):
    @policy(PublicRoutePolicy)
    async def get(self) -> R302:
        """Delete OIDC tokens.

        Deletes the `id_token` cookie from response.
        """
        resp = HTTPFound("/")
        resp.del_cookie("id_token")

        return resp
