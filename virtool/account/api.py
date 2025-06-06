"""API request handlers for account endpoints.

These endpoints modify and return data about the user account associated with the
session or API key making the requests.

"""

from aiohttp.web import Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r401, r404

import virtool.api.authentication
import virtool.api.routes
from virtool.account.models import AccountSettings, Account
from virtool.account.oas import (
    AccountResetPasswordResponse,
    AccountResponse,
    APIKeyResponse,
    CreateAPIKeyResponse,
    CreateKeysRequest,
    CreateLoginRequest,
    ListAPIKeysResponse,
    LoginResponse,
    ResetPasswordRequest,
    UpdateAccountRequest,
    UpdateAccountResponse,
    UpdateKeyRequest,
    UpdateSettingsRequest,
)
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APINoContent, APINotFound
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.utils import set_session_id_cookie, set_session_token_cookie
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.users.checks import check_password_length

routes = virtool.api.routes.Routes()
"""
A :class:`aiohttp.web.RouteTableDef` for account API routes.
"""


@routes.view("/account")
class AccountView(PydanticView):
    async def get(self) -> r200[Account] | r401:
        """Get an account.

        Fetches the details for the account associated with the user agent.

        Status Codes:
            200: Successful Operation
            401: Requires Authorization
        """
        account = await get_data_from_req(self.request).account.get(
            self.request["client"].user_id
        )

        return json_response(account)

    async def patch(
        self, data: UpdateAccountRequest
    ) -> r200[UpdateAccountResponse] | r400 | r401:
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
        data_dict = data.dict(exclude_unset=True)

        if "password" in data_dict:
            error = await check_password_length(self.request, data.password)

            if error:
                raise APIBadRequest(error)

        try:
            account = await get_data_from_req(self.request).account.update(
                self.request["client"].user_id, data
            )
        except ResourceError:
            raise APIBadRequest("Invalid credentials")

        return json_response(UpdateAccountResponse.parse_obj(account))


@routes.view("/account/settings")
class AccountsSettingsView(PydanticView):
    async def get(self) -> r200[AccountSettings] | r401:
        """Get account settings.

        Fetches the settings for the account associated with the user agent.

        Status Codes:
            200: Successful operation
            401: Requires authorization
        """
        account_settings = await get_data_from_req(self.request).account.get_settings(
            self.request["client"].user_id
        )

        return json_response(account_settings)

    async def patch(
        self, data: UpdateSettingsRequest
    ) -> r200[AccountSettings] | r400 | r401:
        """Update account settings.

        Updates the settings of the account associated with the user agent.

        Status Codes:
            200: Successful operation
            400: Invalid input
            401: Requires Authorization
        """
        settings = await get_data_from_req(self.request).account.update_settings(
            data, self.request["client"].user_id
        )

        return json_response(settings)


@routes.view("/account/keys")
class KeysView(PydanticView):
    async def get(self) -> r200[list[ListAPIKeysResponse]] | r401:
        """List API keys.

        Lists all API keys registered on the account associated with the user agent.

        Status Codes:
            200: Successful operation
            401: Requires authorization
        """
        keys = await get_data_from_req(self.request).account.get_keys(
            self.request["client"].user_id
        )

        return json_response(
            [ListAPIKeysResponse.parse_obj(key) for key in keys], status=200
        )

    async def post(
        self, data: CreateKeysRequest
    ) -> r201[CreateAPIKeyResponse] | r400 | r401:
        """Create an API key.

        Creates a new API key on the account associated with the user agent.

        The new key value is returned in the response. **This is the only response
        from the server that will ever include the key**.

        Status Codes:
            201: Successful operation
            400: Invalid input
            401: Requires authorization
        """
        raw, key = await get_data_from_req(self.request).account.create_key(
            data, self.request["client"].user_id
        )

        return json_response(
            CreateAPIKeyResponse(**{**key.dict(), "key": raw}),
            headers={"Location": f"/account/keys/{key.id}"},
            status=201,
        )

    async def delete(self) -> r204 | r401:
        """Purge API keys.

        Deletes all API keys registered for the account associated with the user agent.

        Status Codes:
            204: Successful operation
            401: Requires authorization
        """
        await get_data_from_req(self.request).account.delete_keys(
            self.request["client"].user_id
        )

        raise APINoContent()


@routes.view("/account/keys/{key_id}")
class KeyView(PydanticView):
    async def get(self, key_id: str, /) -> r200[APIKeyResponse] | r404:
        """Get an API key.

        Fetches the details for an API key registered on the account associated with
        the user agent.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            key = await get_data_from_req(self.request).account.get_key(
                self.request["client"].user_id, key_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(APIKeyResponse.parse_obj(key), status=200)

    async def patch(
        self, key_id: str, /, data: UpdateKeyRequest
    ) -> r200[APIKeyResponse] | r400 | r401 | r404:
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
            key = await get_data_from_req(self.request).account.update_key(
                self.request["client"].user_id,
                key_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(APIKeyResponse.parse_obj(key))

    async def delete(self, key_id: str, /) -> r204 | r401 | r404:
        """Delete an API key.

        Removes an API key by its 'key id'.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            404: Not found
        """
        try:
            await get_data_from_req(self.request).account.delete_key(
                self.request["client"].user_id, key_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.view("/account/login")
class LoginView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(self, data: CreateLoginRequest) -> r201[LoginResponse] | r400:
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
            user_id = await get_data_from_req(self.request).account.login(data)
        except ResourceError:
            raise APIBadRequest("Invalid username or password")

        session = None
        reset_code = None
        try:
            session, reset_code = await get_data_from_req(
                self.request
            ).account.get_reset_session(ip, user_id, session_id, data.remember)
        except ResourceError:
            pass

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
            await get_data_from_req(self.request).sessions.delete(session_id)

        session, token = await get_data_from_req(
            self.request
        ).sessions.create_authenticated(
            ip,
            user_id,
            data.remember,
        )

        resp = json_response({"reset": False}, status=201)
        set_session_id_cookie(resp, session.id)
        set_session_token_cookie(resp, token)

        return resp


@routes.view("/account/logout")
class LogoutView(PydanticView):
    @policy(PublicRoutePolicy)
    async def get(self) -> r204:
        """Logout.

        Logs out the user by invalidating the session associated with the user agent. A
        new unauthenticated session ID is returned in cookies.

        Status Codes:
            204: Successful operation
        """
        session = await get_data_from_req(self.request).account.logout(
            self.request["client"].session_id,
            virtool.api.authentication.get_ip(self.request),
        )

        resp = Response(status=200)

        set_session_id_cookie(resp, session.id)
        resp.del_cookie("session_token")

        return resp


@routes.view("/account/reset")
class ResetView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(
        self, data: ResetPasswordRequest
    ) -> r200[AccountResetPasswordResponse] | r400:
        """Reset password.

        Resets the password for the account associated with the requesting session.

        Status Codes:
            200: Successful operation
            400: Invalid input
        """
        if error := await check_password_length(self.request, data.password):
            raise APIBadRequest(error)

        try:
            session, token = await get_data_from_req(self.request).account.reset(
                self.request["client"].session_id,
                data,
                virtool.api.authentication.get_ip(self.request),
            )
        except ResourceNotFoundError:
            raise APIBadRequest("Invalid session")

        try:
            self.request["client"].authorize(session, is_api=False)
        except AttributeError:
            pass

        resp = json_response({"login": False, "reset": False}, status=200)

        set_session_id_cookie(resp, session.id)
        set_session_token_cookie(resp, token)

        return resp
