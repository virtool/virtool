"""API request handlers for account endpoints.

These endpoints modify and return data about the user account associated with the
session or API key making the requests.

"""

from contextlib import suppress

from aiohttp.web import Response

import virtool.api.authentication
import virtool.api.routes
from virtool.account.oas import (
    AccountResponse,
    AccountSettingsResponse,
    AccountSettingsUpdateRequest,
    AccountUpdateRequest,
    AccountUpdateResponse,
    APIKeyResponse,
    CreateKeyRequest,
    CreateKeyResponse,
    CreateLoginRequest,
    CreateLoginResponse,
    ListAPIKeysResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UpdateKeyRequest,
)
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APINoContent, APINotFound
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.status import R200, R201, R204, R400, R401, R404
from virtool.api.utils import set_session_id_cookie, set_session_token_cookie
from virtool.api.view import APIView
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.users.checks import check_password_length
from virtool.validation import is_set

routes = virtool.api.routes.Routes()
"""
A :class:`aiohttp.web.RouteTableDef` for account API routes.
"""


@routes.web.view("/account")
class AccountView(APIView):
    async def get(self) -> R200[AccountResponse] | R401:
        """Get an account.

        Fetches the details for the account associated with the user agent.

        Status Codes:
            200: Successful Operation
            401: Requires Authorization
        """
        account = await self.data.account.get(
            self.request["client"].user_id,
        )

        return json_response(account)

    async def patch(
        self,
        data: AccountUpdateRequest,
    ) -> R200[AccountUpdateResponse] | R400 | R401:
        """Update an account.

        Updates the account associated with the user agent.

        Provide a ``password`` to update the account password. The ``old_password`` must
        also be provided in the request.

        The ``email`` address is not currently used, but will be in future releases.

        Status Codes:
            200: Successful Operation
            400: Invalid old password
            400: Invalid input
            401: Requires Authorization
        """
        if is_set(data.password):
            error = await check_password_length(self.request, data.password)

            if error:
                raise APIBadRequest(error)

        try:
            account = await self.data.account.update(
                self.request["client"].user_id,
                data,
            )
        except ResourceError:
            raise APIBadRequest("Invalid credentials")

        return json_response(AccountUpdateResponse.model_validate(account))


@routes.web.view("/account/settings")
class AccountsSettingsView(APIView):
    async def get(self) -> R200[AccountSettingsResponse] | R401:
        """Get account settings.

        Fetches the settings for the account associated with the user agent.

        Status Codes:
            200: Successful operation
            401: Requires authorization
        """
        account_settings = await self.data.account.get_settings(
            self.request["client"].user_id,
        )

        return json_response(AccountSettingsResponse.parse_obj(account_settings))

    async def patch(
        self,
        data: AccountSettingsUpdateRequest,
    ) -> R200[AccountSettingsResponse] | R400 | R401:
        """Update account settings.

        Updates the settings of the account associated with the user agent.

        Status Codes:
            200: Successful operation
            400: Invalid input
            401: Requires Authorization
        """
        settings = await self.data.account.update_settings(
            data,
            self.request["client"].user_id,
        )

        return json_response(AccountSettingsResponse.model_validate(settings))


@routes.web.view("/account/keys")
class KeysView(APIView):
    async def get(self) -> R200[list[ListAPIKeysResponse]] | R401:
        """List API keys.

        Lists all API keys registered on the account associated with the user agent.

        Status Codes:
            200: Successful operation
            401: Requires authorization
        """
        keys = await self.data.account.get_keys(
            self.request["client"].user_id,
        )

        return json_response(
            [ListAPIKeysResponse.parse_obj(key) for key in keys],
            status=200,
        )

    async def post(
        self,
        data: CreateKeyRequest,
    ) -> R201[CreateKeyResponse] | R400 | R401:
        """Create an API key.

        Creates a new API key on the account associated with the user agent.

        The new key value is returned in the response. **This is the only response
        from the server that will ever include the key**.

        Status Codes:
            201: Successful operation
            400: Invalid input
            401: Requires authorization
        """
        raw, key = await self.data.account.create_key(
            data,
            self.request["client"].user_id,
        )

        return json_response(
            CreateKeyResponse(**{**key.dict(), "key": raw}),
            headers={"Location": f"/account/keys/{key.id}"},
            status=201,
        )

    async def delete(self) -> R204 | R401:
        """Purge API keys.

        Deletes all API keys registered for the account associated with the user agent.

        Status Codes:
            204: Successful operation
            401: Requires authorization
        """
        await self.data.account.delete_keys(
            self.request["client"].user_id,
        )

        raise APINoContent


@routes.web.view("/account/keys/{key_id}")
class KeyView(APIView):
    async def get(self, key_id: str, /) -> R200[APIKeyResponse] | R404:
        """Get an API key.

        Fetches the details for an API key registered on the account associated with
        the user agent.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            key = await self.data.account.get_key(
                self.request["client"].user_id,
                key_id,
            )
        except ResourceNotFoundError:
            raise APINotFound() from None

        return json_response(APIKeyResponse.model_validate(key), status=200)

    async def patch(
        self,
        key_id: str,
        /,
        data: UpdateKeyRequest,
    ) -> R200[APIKeyResponse] | R400 | R401 | R404:
        """Update an API key.

        Updates the permissions an existing API key registered on the account
        associated with the user agent.

        Status Codes:
            200: Successful operation
            400: Invalid input
            401: Requires Authorization
            404: Not found
        """
        try:
            key = await self.data.account.update_key(self.client.user_id, key_id, data)
        except ResourceNotFoundError:
            raise APINotFound() from None

        return json_response(APIKeyResponse.model_validate(key))

    async def delete(self, key_id: str, /) -> R204 | R401 | R404:
        """Delete an API key.

        Removes an API key by its 'key id'.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            404: Not found
        """
        try:
            await self.data.account.delete_key(
                self.request["client"].user_id,
                key_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.web.view("/account/login")
class LoginView(APIView):
    @policy(PublicRoutePolicy)
    async def post(self, data: CreateLoginRequest) -> R201[CreateLoginResponse] | R400:
        """Login.

        Logs in using the passed credentials.

        This creates a new session for the user with `username`. The session ID and
        token are returned in cookies.

        Status Codes:
            201: Successful operation
            400: Invalid input
        """
        session_id = self.request["client"].session_id
        ip = virtool.api.authentication.get_ip(self.request)

        try:
            user_id = await self.data.account.login(data)
        except ResourceError:
            raise APIBadRequest("Invalid username or password")

        try:
            session, reset_code = await self.data.account.get_reset_session(
                ip,
                user_id,
                session_id,
                data.remember,
            )
        except ResourceError:
            session = None
            reset_code = None

        if reset_code:
            resp = json_response(
                {
                    "reset": True,
                    "reset_code": reset_code,
                },
                status=200,
            )
            set_session_id_cookie(resp, session.id)
            return resp

        if session_id is not None:
            await self.data.sessions.delete(session_id)

        session, token = await get_data_from_req(
            self.request,
        ).sessions.create_authenticated(
            ip,
            user_id,
            data.remember,
        )

        resp = json_response({"reset": False}, status=201)
        set_session_id_cookie(resp, session.id)
        set_session_token_cookie(resp, token)

        return resp


@routes.web.view("/account/logout")
class LogoutView(APIView):
    @policy(PublicRoutePolicy)
    async def get(self) -> R204:
        """Logout.

        Logs out the user by invalidating the session associated with the user agent. A
        new unauthenticated session ID is returned in cookies.

        Status Codes:
            204: Successful operation
        """
        session = await self.data.account.logout(
            self.request["client"].session_id,
            virtool.api.authentication.get_ip(self.request),
        )

        resp = Response(status=200)

        set_session_id_cookie(resp, session.id)
        resp.del_cookie("session_token")

        return resp


@routes.web.view("/account/reset")
class ResetView(APIView):
    @policy(PublicRoutePolicy)
    async def post(
        self,
        data: ResetPasswordRequest,
    ) -> R200[ResetPasswordResponse] | R400:
        """Reset password.

        Resets the password for the account associated with the requesting session.

        Status Codes:
            200: Successful operation
            400: Invalid input
        """
        if error := await check_password_length(self.request, data.password):
            raise APIBadRequest(error)

        try:
            session, token = await self.data.account.reset(
                self.request["client"].session_id,
                data,
                virtool.api.authentication.get_ip(self.request),
            )
        except ResourceNotFoundError:
            raise APIBadRequest("Invalid session")

        with suppress(AttributeError):
            self.request["client"].authorize(session, is_api=False)

        resp = json_response({"login": False, "reset": False}, status=200)

        set_session_id_cookie(resp, session.id)
        set_session_token_cookie(resp, token)

        return resp
