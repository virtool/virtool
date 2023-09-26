from typing import Union, Tuple, List

from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.account import Account
from virtool_core.models.account import AccountSettings, APIKey
from virtool_core.models.session import Session
from virtool.data.transforms import apply_transforms
from virtool.groups.transforms import AttachGroupsTransform

import virtool.utils
from virtool.utils import base_processor
from virtool.account.db import (
    compose_password_update,
    API_KEY_PROJECTION,
    fetch_complete_api_key,
)
from virtool.account.oas import (
    UpdateSettingsRequest,
    CreateKeysRequest,
    UpdateKeyRequest,
    ResetPasswordRequest,
    CreateLoginRequest,
    UpdateAccountRequest,
)
from virtool.administrators.oas import UpdateUserRequest
from virtool.authorization.client import AuthorizationClient
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.data.domain import DataLayerDomain
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.users.db import validate_credentials, fetch_complete_user
from virtool.users.utils import limit_permissions

PROJECTION = (
    "_id",
    "handle",
    "administrator",
    "email",
    "groups",
    "last_password_change",
    "permissions",
    "primary_group",
    "settings",
    "force_reset",
)


class AccountData(DataLayerDomain):
    name = "account"

    def __init__(
        self,
        mongo: Mongo,
        redis: Redis,
        authorization_client: AuthorizationClient,
        pg: AsyncEngine,
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._redis = redis
        self._pg = pg

    async def get(self, user_id: str) -> Account:
        """
        Find complete user document.

        :param user_id: the user ID
        :return: the user account
        """
        return Account(
            **{
                **(
                    await fetch_complete_user(
                        self._authorization_client, self._mongo, self._pg, user_id
                    )
                ).dict(),
                "settings": {
                    "quick_analyze_workflow": "nuvs",
                    "show_ids": False,
                    "show_versions": False,
                    "skip_quick_analyze_dialog": False,
                },
            }
        )

    async def update(self, user_id: str, data: UpdateAccountRequest) -> Account:
        """
        Update the user account.

        :param user_id: the user ID
        :param data: the update to the account
        :return: the user account
        """
        update = {}

        data_dict = data.dict(exclude_unset=True)

        if "password" in data_dict:
            if not await validate_credentials(
                self._mongo, user_id, data_dict["old_password"] or ""
            ):
                raise ResourceError("Invalid credentials")

            update = compose_password_update(data_dict["password"])

        if "email" in data_dict:
            update["email"] = data_dict["email"]

        await self._mongo.users.update_one({"_id": user_id}, {"$set": update})

        return await self.get(user_id)

    async def get_settings(self, query_field: str, user_id: str) -> AccountSettings:
        """
        Gets account settings.

        :param query_field: the field to get
        :param user_id: the user ID
        :return: the account settings
        """
        settings = await get_one_field(self._mongo.users, query_field, user_id)

        return AccountSettings(**settings)

    async def update_settings(
        self, data: UpdateSettingsRequest, query_field: str, user_id: str
    ) -> AccountSettings:
        """
        Updates account settings.

        :param data: the update to the account settings
        :param query_field: the field to edit
        :param user_id: the user ID
        :return: the account settings
        """
        settings_from_mongo = await get_one_field(
            self._mongo.users, query_field, user_id
        )

        data_dict = data.dict(exclude_unset=True)

        settings = {**settings_from_mongo, **data_dict}

        await self._mongo.users.update_one({"_id": user_id}, {"$set": settings})

        return AccountSettings(**settings)

    async def get_keys(self, user_id: str) -> List[APIKey]:
        """
        Gets API keys associated with the authenticated user account.

        :param user_id: the user ID
        :return: the api keys
        """

        keys = await apply_transforms(
            [
                base_processor(key)
                async for key in self._mongo.keys.find({"user.id": user_id})
            ],
            [
                AttachGroupsTransform(self._mongo),
            ],
        )

        return [APIKey(**key) for key in keys]

    async def create_key(
        self, data: CreateKeysRequest, user_id: str
    ) -> Tuple[str, APIKey]:
        """
        Create a new API key.

        :param data: the fields to create a new API key
        :param user_id: the user ID
        :param permissions: the permissions of the requesting user
        :return: the API key
        """
        permissions_dict = data.permissions.dict(exclude_unset=True)

        user = await self.data.users.get(user_id)

        key_permissions = {
            **virtool.users.utils.generate_base_permissions(),
            **permissions_dict,
        }

        if not user.administrator:
            key_permissions = virtool.users.utils.limit_permissions(
                key_permissions, user.permissions.dict()
            )

        raw, hashed = virtool.utils.generate_key()

        document = {
            "_id": hashed,
            "id": await virtool.account.db.get_alternate_id(self._mongo, data.name),
            "administrator": user.administrator,
            "name": data.name,
            "groups": [group.id for group in user.groups],
            "permissions": key_permissions,
            "created_at": virtool.utils.timestamp(),
            "user": {"id": user_id},
        }

        await self._mongo.keys.insert_one(document)

        return raw, await fetch_complete_api_key(self._mongo, document["id"])

    async def delete_keys(self, user_id: str):
        """
        Delete all API keys for the account associated with the requesting session.

        :param user_id: the user ID
        """
        await self._mongo.keys.delete_many({"user.id": user_id})

    async def get_key(self, user_id: str, key_id: str) -> APIKey:
        """
        Get the complete representation of the API key identified by the `key_id`.

        :param user_id: the user ID
        :param key_id: the ID of the API key to get
        :return: the API key
        """
        document = await self._mongo.keys.find_one(
            {"id": key_id, "user.id": user_id}, API_KEY_PROJECTION
        )

        if document is None:
            raise ResourceNotFoundError()

        return APIKey(**document)

    async def update_key(
        self, user_id: str, key_id: str, data: UpdateKeyRequest
    ) -> APIKey:
        """
        Change the permissions for an existing API key.

        :param user_id: the user ID
        :param key_id: the ID of the API key to update
        :param data: permissions update
        :return: the API key
        """
        if data.permissions is None:
            permissions_update = {}
        else:
            permissions_update = data.permissions.dict(exclude_unset=True)

        if not await self._mongo.keys.count_documents({"id": key_id}):
            raise ResourceNotFoundError()

        user = await self._mongo.users.find_one(
            user_id, ["administrator", "permissions"]
        )

        # The permissions currently assigned to the API key.
        permissions = await get_one_field(
            self._mongo.keys, "permissions", {"id": key_id, "user.id": user_id}
        )

        permissions.update(permissions_update)

        if not user["administrator"]:
            permissions = limit_permissions(permissions, user["permissions"])

        document = await self._mongo.keys.find_one_and_update(
            {"id": key_id},
            {"$set": {"permissions": permissions}},
            projection=API_KEY_PROJECTION,
        )

        return APIKey(**document)

    async def delete_key(self, user_id: str, key_id: str):
        """
        Delete an API key by its id.

        :param user_id: the user ID
        :param key_id: the ID of the API key to delete
        """
        delete_result = await self._mongo.keys.delete_one(
            {"id": key_id, "user.id": user_id}
        )

        if delete_result.deleted_count == 0:
            raise ResourceNotFoundError()

    async def login(self, data: CreateLoginRequest) -> str:
        """
        Create a new session for the user with `username`.

        :param data: the login data
        :return: string representation of user_id
        """
        # When `remember` is set, the session will last for 1 month instead of the
        # 1-hour default

        # Re-render the login page with an error message if the username doesn't
        # correlate to a user_id value in
        # the database and/or password are invalid.
        document = await self._mongo.users.find_one({"handle": data.username})

        if not document or not await validate_credentials(
            self._mongo, document["_id"], data.password
        ):
            raise ResourceError()

        return document["_id"]

    async def get_reset_session(
        self, ip: str, user_id: str, session_id: str, remember: bool
    ) -> [Session, str]:
        """
        Check if user password should be reset and return a reset code if it
        should be.

        :param ip: the ip address of the requesiton client
        :param user_id: the login session ID
        :param session_id: the id of the session getting the reset code
        :param remember: boolean indicating whether the sessions
        should be remembered
        """

        if await get_one_field(self._mongo.users, "force_reset", user_id):
            await self.data.sessions.delete(session_id)
            return await self.data.sessions.create_reset(ip, user_id, remember)

        raise ResourceError

    async def logout(self, old_session_id: str, ip: str) -> Session:
        """
        Invalidates the requesting session, effectively logging out the user.

        :param old_session_id: the ID of the old session
        :param ip: the ip address of the client
        :return: the session_id, session, and session token
        """
        await self.data.sessions.delete(old_session_id)
        return await self.data.sessions.create_anonymous(ip)

    async def reset(
        self, session_id: str, data: ResetPasswordRequest, ip: str
    ) -> Tuple[Session, str]:
        """
        Resets the password for a session user.

        :param session_id: the ID of the session to reset
        :param data: the data needed to reset session
        :param ip: the ip address of the client
        """

        session = await self.data.sessions.get_reset(session_id, data.reset_code)

        await self.data.sessions.delete(session_id)

        await self.data.users.update(
            session.reset.user_id,
            UpdateUserRequest(force_reset=False, password=data.password),
        )

        return await self.data.sessions.create_authenticated(
            ip, session.reset.user_id, remember=session.reset.remember
        )
