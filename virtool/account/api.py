"""
API request handlers for account endpoints.

These endpoints modify and return data about the user account associated with the
session or API key making the requests.

"""
from typing import Union, List

from aiohttp.web import HTTPNoContent, Response
from aiohttp.web_exceptions import HTTPBadRequest
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r401, r404

import virtool.account.db
import virtool.http.auth
import virtool.http.routes
from virtool.account.oas import (
    EditAccountSchema,
    EditSettingsSchema,
    CreateKeysSchema,
    EditKeySchema,
    ResetPasswordSchema,
    CreateLoginSchema,
    AccountResponse,
    EditAccountResponse,
    AccountSettingsResponse,
    GetAPIKeysResponse,
    CreateAPIKeyResponse,
    APIKeyResponse,
    LoginResponse,
    AccountResetPasswordResponse,
)
from virtool.api.response import NotFound, json_response
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, PublicRoutePolicy
from virtool.http.utils import set_session_id_cookie, set_session_token_cookie
from virtool.mongo.utils import get_one_field
from virtool.users.checks import check_password_length
from virtool.users.db import validate_credentials
from virtool.users.oas import UpdateUserSchema
from virtool.users.sessions import create_reset_code, replace_session
from virtool.users.utils import limit_permissions
from virtool.utils import base_processor

API_KEY_PROJECTION = {"_id": False, "user": False}
"""
A MongoDB projection to use when returning API key documents to clients.

The key should never be sent to client after its creation.
"""

routes = virtool.http.routes.Routes()
"""
A :class:`aiohttp.web.RouteTableDef` for account API routes.
"""


@routes.view("/account")
class AccountView(PydanticView):
    async def get(self) -> Union[r200[AccountResponse], r401]:
        """
        Get complete user document.

        Status Codes:
            200: Successful Operation
            401: Requires Authorization
        """
        document = await virtool.account.db.get(
            self.request.app["db"], self.request["client"].user_id
        )
        return json_response(base_processor(document))

    async def patch(
        self, data: EditAccountSchema
    ) -> Union[r200[EditAccountResponse], r400, r401]:
        """
        Edit the user account.

        Status Codes:
            200: Successful Operation
            400: Invalid old password
            400: Invalid input
            401: Requires Authorization
        """
        db = self.request.app["db"]
        user_id = self.request["client"].user_id

        password = data.password
        old_password = data.old_password

        update = {}

        if password is not None:
            error = await check_password_length(self.request, password)

            if error:
                raise HTTPBadRequest(text=error)

            if not await validate_credentials(db, user_id, old_password or ""):
                raise HTTPBadRequest(text="Invalid credentials")

            update = virtool.account.db.compose_password_update(password)

        if data.email is not None:
            update["email"] = data.email

        if update:
            document = await db.users.find_one_and_update(
                {"_id": user_id},
                {"$set": update},
                projection=virtool.account.db.PROJECTION,
            )
        else:
            document = await virtool.account.db.get(db, user_id)

        return json_response(base_processor(document))


@routes.view("/account/settings")
class SettingsView(PydanticView):
    async def get(self) -> Union[r200[AccountSettingsResponse], r401]:
        """
        Get account settings

        Status Codes:
            200: Successful operation
            401: Requires authorization
        """
        account_settings = await get_one_field(
            self.request.app["db"].users, "settings", self.request["client"].user_id
        )

        return json_response(account_settings)

    async def patch(
        self, data: EditSettingsSchema
    ) -> Union[r200[AccountSettingsResponse], r400, r401]:
        """
        Update account settings. All fields are optional.

        Status Codes:
            200: Successful operation
            400: Invalid input
            401: Requires Authorization
        """
        db = self.request.app["db"]

        user_id = self.request["client"].user_id

        settings_from_db = await get_one_field(db.users, "settings", user_id)

        data_dict = data.dict(exclude_unset=True)

        settings = {**settings_from_db, **data_dict}

        await db.users.update_one({"_id": user_id}, {"$set": settings})

        return json_response(settings)


@routes.view("/account/keys")
class KeysView(PydanticView):
    async def get(self) -> Union[r200[List[GetAPIKeysResponse]], r401]:
        """
        List API keys associated with the authenticated user account.

        Status Codes:
            200: Successful operation
            401: Requires authorization
        """
        db = self.request.app["db"]

        user_id = self.request["client"].user_id

        cursor = db.keys.find({"user.id": user_id}, API_KEY_PROJECTION)

        return json_response([d async for d in cursor], status=200)

    async def post(
        self, data: CreateKeysSchema
    ) -> Union[r201[CreateAPIKeyResponse], r400, r401]:
        """
        Create a new API key.

        The new key value is returned in the response. This is the only response
        from the server that will ever include the key.

        Status Codes:
            201: Successful operation
            400: Invalid input
            401: Requires authorization
        """
        db = self.request.app["db"]

        user_id = self.request["client"].user_id

        document = await virtool.account.db.create_api_key(
            db, data.name, data.permissions, user_id
        )

        headers = {"Location": f"/account/keys/{document['id']}"}

        return json_response(document, headers=headers, status=201)

    async def delete(self) -> Union[r204, r401]:
        """
        Remove all API keys for the account associated with the requesting session.

        Status Codes:
            204: Successful operation
            401: Requires authorization
        """
        await self.request.app["db"].keys.delete_many(
            {"user.id": self.request["client"].user_id}
        )
        raise HTTPNoContent


@routes.view("/account/keys/{key_id}")
class KeyView(PydanticView):
    async def get(self) -> Union[r200[APIKeyResponse], r404]:
        """
        Get the complete representation of the API key identified by the `key_id`.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        db = self.request.app["db"]
        user_id = self.request["client"].user_id
        key_id = self.request.match_info["key_id"]

        document = await db.keys.find_one(
            {"id": key_id, "user.id": user_id}, API_KEY_PROJECTION
        )

        if document is None:
            raise NotFound()

        return json_response(document, status=200)

    async def patch(
        self, data: EditKeySchema
    ) -> Union[r200[APIKeyResponse], r400, r401, r404]:
        """
        Change the permissions for an existing API key.

        Status Codes:
            200: Successful operation
            400: Invalid input
            401: Requires Authorization
            404: Not found
        """
        db = self.request.app["db"]

        key_id = self.request.match_info.get("key_id")

        if not await db.keys.count_documents({"id": key_id}):
            raise NotFound()

        user_id = self.request["client"].user_id

        user = await db.users.find_one(user_id, ["administrator", "permissions"])

        # The permissions currently assigned to the API key.
        permissions = await get_one_field(
            db.keys, "permissions", {"id": key_id, "user.id": user_id}
        )

        permissions.update(data.permissions)

        if not user["administrator"]:
            permissions = limit_permissions(permissions, user["permissions"])

        document = await db.keys.find_one_and_update(
            {"id": key_id},
            {"$set": {"permissions": permissions}},
            projection=API_KEY_PROJECTION,
        )

        return json_response(document)

    async def delete(self) -> Union[r204, r401, r404]:
        """
        Remove an API key by its ID.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            404: Not found
        """
        db = self.request.app["db"]
        user_id = self.request["client"].user_id
        key_id = self.request.match_info["key_id"]

        delete_result = await db.keys.delete_one({"id": key_id, "user.id": user_id})

        if delete_result.deleted_count == 0:
            raise NotFound()

        raise HTTPNoContent


@routes.view("/account/login")
class LoginView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(
        self, data: CreateLoginSchema
    ) -> Union[r201[LoginResponse], r400]:
        """
        Create a new session for the user with `username`.

        Status Codes:
            201: Successful operation
            400: Invalid input
        """
        db = self.request.app["db"]

        handle = data.username
        password = data.password

        # When this value is set, the session will last for 1 month instead of the
        # 1-hour default.
        remember = data.remember

        # Re-render the login page with an error message if the username doesn't
        # correlate to a user_id value in
        # the database and/or password are invalid.
        document = await db.users.find_one({"handle": handle})
        if not document or not await validate_credentials(
            db, document["_id"], password
        ):
            raise HTTPBadRequest(text="Invalid username or password")

        user_id = document["_id"]

        session_id = self.request.cookies.get("session_id")

        # If the user's password needs to be reset, redirect to the reset page without
        # authorizing the session. A one-time reset code is generated and
        # added to the query string.
        if await get_one_field(db.users, "force_reset", user_id):
            return json_response(
                {
                    "reset": True,
                    "reset_code": await create_reset_code(
                        db, session_id, user_id, remember
                    ),
                },
                status=200,
            )

        session, token = await virtool.users.sessions.replace_session(
            db, session_id, virtool.http.auth.get_ip(self.request), user_id, remember
        )

        resp = json_response({"reset": False}, status=201)

        set_session_id_cookie(resp, session["_id"])
        set_session_token_cookie(resp, token)

        return resp


@routes.view("/account/logout")
class LogoutView(PydanticView):
    @policy(PublicRoutePolicy)
    async def get(self) -> r204:
        """
        Invalidates the requesting session, effectively logging out the user.

        Status Codes:
            204: Successful operation
        """
        db = self.request.app["db"]
        old_session_id = self.request.cookies.get("session_id")

        session, _ = await replace_session(
            db, old_session_id, virtool.http.auth.get_ip(self.request)
        )

        resp = Response(status=200)

        set_session_id_cookie(resp, session["_id"])
        resp.del_cookie("session_token")

        return resp


@routes.view("/account/reset")
class ResetView(PydanticView):
    @policy(PublicRoutePolicy)
    async def post(
        self, data: ResetPasswordSchema
    ) -> Union[r200[AccountResetPasswordResponse], r400]:
        """
        Handles `POST` requests for resetting the password for a session user.

        Status Codes:
            200: Successful operation
            400: Invalid input
        """
        db = self.request.app["db"]
        session_id = self.request.cookies.get("session_id")

        password = data.password
        reset_code = data.reset_code

        session = await db.sessions.find_one(session_id)

        if error := await check_password_length(self.request, password):
            raise HTTPBadRequest(text=error)

        user_id = session["reset_user_id"]

        if (
            not session.get("reset_code")
            or not session.get("reset_user_id")
            or reset_code != session.get("reset_code")
        ):
            return json_response(
                {
                    "error": error,
                    "reset_code": await create_reset_code(
                        db, session_id, user_id=user_id
                    ),
                },
                status=400,
            )

        await get_data_from_req(self.request).users.update(
            user_id,
            UpdateUserSchema(force_reset=False, password=password),
        )

        new_session, token = await replace_session(
            db,
            session_id,
            virtool.http.auth.get_ip(self.request),
            user_id,
            remember=session.get("reset_remember", False),
        )

        try:
            self.request["client"].authorize(new_session, is_api=False)
        except AttributeError:
            pass

        resp = json_response({"login": False, "reset": False}, status=200)

        set_session_id_cookie(resp, new_session["_id"])
        set_session_token_cookie(resp, token)

        return resp
