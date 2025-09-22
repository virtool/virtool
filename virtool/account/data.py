from sqlalchemy import cast, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.account.models import Account, AccountSettings, APIKey
from virtool.account.mongo import (
    compose_password_update,
)
from virtool.account.oas import (
    CreateKeyRequest,
    CreateLoginRequest,
    ResetPasswordRequest,
    UpdateAccountRequest,
    UpdateKeyRequest,
    UpdateSettingsRequest,
)
from virtool.administrators.oas import UpdateUserRequest
from virtool.authorization.client import AuthorizationClient
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.users.utils import check_password
from virtool.data.transforms import apply_transforms
from virtool.groups.transforms import AttachGroupsTransform
from virtool.models.sessions import Session
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.users.pg import SQLUser
from virtool.users.utils import limit_permissions
from virtool.utils import base_processor, hash_key

logger = get_logger(layer="data", domain="account")


class AccountData(DataLayerDomain):
    name = "account"

    def __init__(
        self,
        authorization_client: AuthorizationClient,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def get(self, user_id: int) -> Account:
        """Get the account for the given ``user_id``.

        :param user_id: the user ID
        :return: the user account
        """
        if user := await self.data.users.get(user_id):
            # Get email and settings from PostgreSQL
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLUser.email, SQLUser.settings).where(SQLUser.id == user_id)
                )
                row = result.one_or_none()

                if row is None:
                    raise ResourceNotFoundError

                email, settings = row

            return Account(
                **{
                    **user.dict(),
                    "email": email,
                    "settings": settings,
                },
            )

        raise ResourceNotFoundError

    async def update(self, user_id: int, data: UpdateAccountRequest) -> Account:
        """Update the user account.

        :param user_id: the user ID
        :param data: the update to the account
        :return: the user account
        """
        values = {}

        data_dict = data.dict(exclude_unset=True)

        if "password" in data_dict:
            if not await self.data.users.validate_password(
                user_id, data_dict["old_password"] or ""
            ):
                raise ResourceError("Invalid credentials")

            values.update(compose_password_update(data_dict["password"]))

        if "email" in data_dict:
            values["email"] = data_dict["email"]

        if values:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    update(SQLUser).where(SQLUser.id == user_id).values(values),
                )

                if result.rowcount == 0:
                    raise ResourceNotFoundError

                await session.commit()

        return await self.get(user_id)

    async def get_settings(self, user_id: int) -> AccountSettings:
        """Get account settings.

        :param user_id: the user ID
        :return: the account settings
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.settings).where(SQLUser.id == user_id)
            )

            settings = result.scalar_one_or_none()

            if settings is None:
                raise ResourceNotFoundError

            return AccountSettings(**settings)

    async def update_settings(
        self,
        data: UpdateSettingsRequest,
        user_id: int,
    ) -> AccountSettings:
        """Update account settings.

        :param data: the update to the account settings
        :param user_id: the user ID
        :return: the account settings
        """
        update_data = data.dict(exclude_unset=True)

        if update_data:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    update(SQLUser)
                    .where(SQLUser.id == user_id)
                    .values(
                        settings=SQLUser.settings.op("||")(cast(update_data, JSONB))
                    )
                    .returning(SQLUser.settings)
                )

                updated_settings = result.scalar_one_or_none()

                if updated_settings is None:
                    raise ResourceNotFoundError("User not found")

                await session.commit()

                return AccountSettings(**updated_settings)

        return await self.get_settings(user_id)

    async def get_keys(self, user_id: str) -> list[APIKey]:
        """Get API keys associated with the authenticated user account.

        :param user_id: the user ID
        :return: the api keys
        """
        keys = await apply_transforms(
            [
                base_processor(key)
                async for key in self._mongo.keys.find(
                    {"user.id": user_id},
                    {"_id": False, "user": False},
                )
            ],
            [
                AttachGroupsTransform(self._pg),
            ],
        )

        return [APIKey(**key) for key in keys]

    async def get_key(self, user_id: int, key_id: str) -> APIKey:
        """Get the complete representation of the API key identified by the `key_id`.

        The internal key ID and secret key value itself are not returned in the
        response.

        :param user_id: the user ID
        :param key_id: the ID of the API key to get
        :return: the API key
        """
        document = await self._mongo.keys.find_one(
            {"id": key_id, "user.id": user_id},
            {
                "_id": False,
                "user": False,
            },
        )

        user = await self.data.users.get(user_id)

        if not document:
            raise ResourceNotFoundError

        document = await apply_transforms(
            base_processor(document),
            [
                AttachGroupsTransform(self._pg),
            ],
        )

        if user.administrator_role:
            document["permissions"] = document["permissions"]
        else:
            document["permissions"] = limit_permissions(
                document["permissions"],
                user.permissions.dict(),
            )

        return APIKey(
            **{
                **document,
                "groups": sorted(document["groups"], key=lambda g: g["name"]),
            },
        )

    async def get_key_by_secret(self, user_id: int, key: str) -> APIKey:
        """Get the complete representation of the API key with secret value ``key``.

        The secret key is not returned in the result.

        :param user_id: the user id
        :param key: the raw API key
        :return: the API key
        """
        document = await self._mongo.keys.find_one(
            {"_id": hash_key(key), "user.id": user_id},
            {
                "_id": False,
                "user": False,
            },
        )

        user = await self.data.users.get(user_id)

        if not document:
            raise ResourceNotFoundError

        return APIKey(
            **{
                **document,
                "groups": user.groups,
                "permissions": {**document["permissions"], **user.permissions.dict()},
            },
        )

    async def create_key(
        self,
        data: CreateKeyRequest,
        user_id: int,
    ) -> tuple[str, APIKey]:
        """Create a new API key.

        :param data: the fields to create a new API key
        :param user_id: the user ID
        :return: the API key
        """
        user = await self.data.users.get(user_id)

        raw, hashed = virtool.utils.generate_key()

        id_ = await virtool.account.mongo.get_alternate_id(self._mongo, data.name)

        await self._mongo.keys.insert_one(
            {
                "_id": hashed,
                "id": id_,
                "created_at": virtool.utils.timestamp(),
                "groups": [group.id for group in user.groups],
                "name": data.name,
                "permissions": data.permissions.dict(exclude_unset=True),
                "user": {"id": user_id},
            },
        )

        logger.info("created key", raw=raw, hashed=hashed)

        return raw, await self.get_key(user_id, id_)

    async def delete_keys(self, user_id: str) -> None:
        """Delete all API keys for the account associated with the requesting session.

        :param user_id: the user ID
        """
        await self._mongo.keys.delete_many({"user.id": user_id})

    async def update_key(
        self,
        user_id: str,
        key_id: str,
        data: UpdateKeyRequest,
    ) -> APIKey:
        """Change the permissions for an existing API key.

        :param user_id: the user ID
        :param key_id: the ID of the API key to update
        :param data: permissions update
        :return: the API key
        """
        if data.permissions is None:
            update = {}
        else:
            update = data.permissions.dict(exclude_unset=True)

        if not await self._mongo.keys.count_documents({"id": key_id}):
            raise ResourceNotFoundError()

        new_permissions = {
            **(
                await get_one_field(
                    self._mongo.keys,
                    "permissions",
                    {"id": key_id, "user.id": user_id},
                )
            ),
            **update,
        }

        await self._mongo.keys.update_one(
            {"id": key_id},
            {"$set": {"permissions": new_permissions}},
        )

        return await self.get_key(user_id, key_id)

    async def delete_key(self, user_id: str, key_id: str) -> None:
        """Delete an API key by its id.

        :param user_id: the user ID
        :param key_id: the ID of the API key to delete
        """
        delete_result = await self._mongo.keys.delete_one(
            {"id": key_id, "user.id": user_id},
        )

        if delete_result.deleted_count == 0:
            raise ResourceNotFoundError()

    async def login(self, data: CreateLoginRequest) -> str:
        """Create a new session for the user with `username`.

        :param data: the login data
        :return: string representation of user_id
        """
        # When `remember` is set, the session will last for 1 month instead of the
        # 1-hour default

        # Re-render the login page with an error message if the username doesn't
        # correlate to a user_id value in
        # the database and/or password are invalid.
        try:
            user = await self.data.users.get_by_handle(data.handle)
        except ResourceError:
            raise ResourceError()

        if not await self.data.users.validate_password(user.id, data.password):
            raise ResourceError()

        return str(user.id)

    async def get_reset_session(
        self,
        ip: str,
        user_id: str,
        session_id: str,
        remember: bool,
    ) -> tuple[Session, str]:
        """Check if user password should be reset and return a reset code if it
        should be.

        :param ip: the ip address of the requesting client
        :param user_id: the login session ID
        :param session_id: the id of the session getting the reset code
        :param remember: boolean indicating whether the sessions should be remembered
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.force_reset).where(SQLUser.id == int(user_id))
            )
            force_reset = result.scalar_one_or_none()

        if force_reset:
            await self.data.sessions.delete(session_id)
            return await self.data.sessions.create_reset(ip, user_id, remember)

        raise ResourceError

    async def logout(self, old_session_id: str, ip: str) -> Session:
        """Invalidates the requesting session, effectively logging out the user.

        :param old_session_id: the ID of the old session
        :param ip: the ip address of the client
        :return: the session_id, session, and session token
        """
        await self.data.sessions.delete(old_session_id)
        return await self.data.sessions.create_anonymous(ip)

    async def reset(
        self,
        session_id: str,
        data: ResetPasswordRequest,
        ip: str,
    ) -> tuple[Session, str]:
        """Resets the password for a session user.

        :param session_id: the ID of the session to reset
        :param data: the data needed to reset session
        :param ip: the ip address of the client
        """
        session = await self.data.sessions.get_reset(session_id, data.reset_code)

        if await self.data.users.validate_password(
            session.reset.user_id, data.password
        ):
            raise ResourceError("Cannot reuse current password")

        await self.data.sessions.delete_by_user(session.reset.user_id)

        await self.data.users.update(
            session.reset.user_id,
            UpdateUserRequest(force_reset=False, password=data.password),
        )

        return await self.data.sessions.create_authenticated(
            ip,
            session.reset.user_id,
            remember=session.reset.remember,
        )
