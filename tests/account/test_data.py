import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.users.pg import SQLUser


class TestGetKeyBySecret:
    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """``get_key_by_secret`` resolves a key by its raw secret value."""
        user = await fake.users.create()

        raw_key, api_key = await fake.api_keys.create(
            user,
            PermissionsUpdate(create_sample=True),
        )

        result = await data_layer.account.get_key_by_secret(user.id, raw_key)

        assert result.id == api_key.id
        assert result.name == "Test Key"

    async def test_legacy_user_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """``get_key_by_secret`` resolves a key for a user that carries a
        ``legacy_id``.

        The ``api_keys`` foreign key is on the integer ``user_id``, so the
        lookup must not depend on the user's legacy string id. This guards
        against re-introducing the dropped Mongo/PG user-id translation path.
        """
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLUser)
                .where(SQLUser.id == user.id)
                .values(legacy_id="legacy_owner"),
            )
            await session.commit()

        raw_key, api_key = await fake.api_keys.create(user)

        result = await data_layer.account.get_key_by_secret(user.id, raw_key)

        assert result.id == api_key.id

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """``get_key_by_secret`` raises ``ResourceNotFoundError`` for an unknown key."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.get_key_by_secret(user.id, "nonexistent_key")
