from sqlalchemy import cast, delete, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.users.utils
import virtool.utils
from virtool.account.models import Account, AccountSettings, APIKey
from virtool.account.oas import (
    CreateKeyRequest,
    UpdateAccountRequest,
    UpdateKeyRequest,
    UpdateSettingsRequest,
)
from virtool.account.sql import SQLAPIKey
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.models.sessions import Session
from virtool.users.pg import SQLUser
from virtool.users.utils import limit_permissions
from virtool.utils import hash_key

logger = get_logger(layer="data", domain="account")


class AccountData(DataLayerDomain):
    name = "account"

    def __init__(
        self,
        pg: AsyncEngine,
    ):
        self._pg = pg

    async def get(self, user_id: int) -> Account:
        """Get the account for the given ``user_id``.

        :param user_id: the user ID
        :return: the user account
        """
        if user := await self.data.users.get(user_id):
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

    async def update(
        self, user_id: int, data: UpdateAccountRequest, ip: str | None = None
    ) -> tuple[Account, Session | None, str | None]:
        """Update the user account.

        :param user_id: the user ID
        :param data: the update to the account
        :param ip: the client IP address (required for password changes)
        :return: the user account, new session (if password changed), and session token (if password changed)
        """
        values = {}
        password_changed = False

        data_dict = data.dict(exclude_unset=True)

        if "password" in data_dict:
            if not await self.data.users.validate_password(
                user_id, data_dict["old_password"] or ""
            ):
                raise ResourceError("Invalid credentials")

            values.update(
                {
                    "password": virtool.users.utils.hash_password(
                        data_dict["password"]
                    ),
                    "last_password_change": virtool.utils.timestamp(),
                    "force_reset": False,
                }
            )
            password_changed = True

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

        # If password was changed, invalidate all existing sessions and create a new one
        if password_changed:
            if ip is None:
                raise ValueError("IP address is required when changing password")

            # Delete all existing sessions for the user
            await self.data.sessions.delete_by_user(user_id)

            # Create a new authenticated session
            new_session, token = await self.data.sessions.create_authenticated(
                ip, user_id, remember=False
            )

            account = await self.get(user_id)
            return account, new_session, token

        account = await self.get(user_id)
        return account, None, None

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

    async def get_keys(self, user_id: int) -> list[APIKey]:
        """Get API keys associated with the authenticated user account.

        :param user_id: the user ID
        :return: the api keys
        """
        user = await self.data.users.get(user_id)
        groups = sorted(user.groups, key=lambda group: group.name)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLAPIKey).where(SQLAPIKey.user_id == user_id),
            )
            keys = result.scalars().all()

        return [
            APIKey(
                id=key.id,
                created_at=key.created_at,
                groups=groups,
                name=key.name,
                permissions=key.permissions,
            )
            for key in keys
        ]

    async def get_key(self, user_id: int, key_id: int) -> APIKey:
        """Get the complete representation of the API key identified by the `key_id`.

        The internal key ID and secret key value itself are not returned in the
        response.

        :param user_id: the user ID
        :param key_id: the ID of the API key to get
        :return: the API key
        """
        user = await self.data.users.get(user_id)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLAPIKey).where(
                    SQLAPIKey.id == key_id,
                    SQLAPIKey.user_id == user_id,
                ),
            )
            key = result.scalar_one_or_none()

        if key is None:
            raise ResourceNotFoundError

        if user.administrator_role:
            permissions = key.permissions
        else:
            permissions = limit_permissions(
                key.permissions,
                user.permissions.dict(),
            )

        return APIKey(
            id=key.id,
            created_at=key.created_at,
            groups=sorted(user.groups, key=lambda group: group.name),
            name=key.name,
            permissions=permissions,
        )

    async def get_key_by_secret(self, user_id: int, key: str) -> APIKey:
        """Get the complete representation of the API key with secret value ``key``.

        The secret key is not returned in the result.

        :param user_id: the user id
        :param key: the raw API key
        :return: the API key
        """
        user = await self.data.users.get(user_id)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLAPIKey).where(
                    SQLAPIKey.user_id == user_id,
                    SQLAPIKey.hashed == hash_key(key),
                ),
            )
            api_key = result.scalar_one_or_none()

        if api_key is None:
            raise ResourceNotFoundError

        return APIKey(
            id=api_key.id,
            created_at=api_key.created_at,
            groups=sorted(user.groups, key=lambda group: group.name),
            name=api_key.name,
            permissions=api_key.permissions,
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
        raw, hashed = virtool.utils.generate_key()

        created_at = virtool.utils.timestamp()
        permissions = data.permissions.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            sql_key = SQLAPIKey(
                hashed=hashed,
                name=data.name,
                created_at=created_at,
                user_id=user_id,
                permissions=permissions,
            )
            session.add(sql_key)
            await session.flush()
            key_id = sql_key.id

            await session.commit()

        logger.info("created key", raw=raw, hashed=hashed)

        return raw, await self.get_key(user_id, key_id)

    async def delete_keys(self, user_id: int) -> None:
        """Delete all API keys for the account associated with the requesting session.

        :param user_id: the user ID
        """
        async with AsyncSession(self._pg) as session:
            await session.execute(
                delete(SQLAPIKey).where(SQLAPIKey.user_id == user_id),
            )
            await session.commit()

    async def update_key(
        self,
        user_id: int,
        key_id: int,
        data: UpdateKeyRequest,
    ) -> APIKey:
        """Change the permissions for an existing API key.

        :param user_id: the user ID
        :param key_id: the ID of the API key to update
        :param data: permissions update
        :return: the API key
        """
        if data.permissions is None:
            permissions_update = {}
        else:
            permissions_update = data.permissions.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLAPIKey.permissions).where(
                    SQLAPIKey.id == key_id,
                    SQLAPIKey.user_id == user_id,
                ),
            )
            existing_permissions = result.scalar_one_or_none()

        if existing_permissions is None:
            raise ResourceNotFoundError

        new_permissions = {
            **existing_permissions,
            **permissions_update,
        }

        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLAPIKey)
                .where(SQLAPIKey.id == key_id, SQLAPIKey.user_id == user_id)
                .values(permissions=new_permissions),
            )
            await session.commit()

        return await self.get_key(user_id, key_id)

    async def delete_key(self, user_id: int, key_id: int) -> None:
        """Delete an API key by its id.

        :param user_id: the user ID
        :param key_id: the ID of the API key to delete
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                delete(SQLAPIKey).where(
                    SQLAPIKey.id == key_id,
                    SQLAPIKey.user_id == user_id,
                ),
            )

            if result.rowcount == 0:
                raise ResourceNotFoundError

            await session.commit()
