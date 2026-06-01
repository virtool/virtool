import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.account.oas import CreateKeyRequest, UpdateKeyRequest
from virtool.account.sql import SQLAPIKey
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.users.pg import SQLUser


async def get_sql_keys(pg: AsyncEngine) -> list[dict]:
    """Return every ``api_keys`` row as a plain dict, ordered by id."""
    async with AsyncSession(pg) as session:
        rows = (
            (await session.execute(select(SQLAPIKey).order_by(SQLAPIKey.id)))
            .scalars()
            .all()
        )

        return [
            {
                "id": row.id,
                "hashed": row.hashed,
                "name": row.name,
                "created_at": row.created_at,
                "user_id": row.user_id,
                "permissions": row.permissions,
            }
            for row in rows
        ]


class TestCreateKey:
    @pytest.mark.parametrize(
        "has_permission",
        [True, False],
        ids=["has_permission", "does_not_have_permission"],
    )
    async def test_ok(
        self,
        has_permission: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
    ):
        """A created key is written to both MongoDB and PostgreSQL, sharing the
        PostgreSQL integer id, with permissions limited to those the owner holds.
        """
        mocker.patch("virtool.utils.generate_key", return_value=("bar", "baz"))

        group_1 = await fake.groups.create()
        group_2 = await fake.groups.create(
            PermissionsUpdate(
                **{
                    Permission.create_sample: True,
                    Permission.modify_subtraction: has_permission,
                },
            ),
        )

        user = await fake.users.create(groups=[group_1, group_2])

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(
                name="Foo",
                permissions=PermissionsUpdate(
                    create_sample=True, modify_subtraction=True
                ),
            ),
            user.id,
        )

        assert api_key == snapshot(name="data")

        mongo_document = await mongo.keys.find_one()
        assert mongo_document == snapshot(name="mongo")

        sql_keys = await get_sql_keys(pg)
        assert sql_keys == snapshot(name="pg")

        assert mongo_document["id"] == sql_keys[0]["id"] == api_key.id
        assert mongo_document["_id"] == sql_keys[0]["hashed"]

    async def test_rollback(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """When the PostgreSQL write fails, the MongoDB write is rolled back and no
        key is left in either store.
        """
        mocker.patch("virtool.utils.generate_key", return_value=("bar", "baz"))

        user = await fake.users.create()

        mocker.patch.object(
            AsyncSession, "commit", side_effect=RuntimeError("postgres down")
        )

        with pytest.raises(RuntimeError, match="postgres down"):
            await data_layer.account.create_key(
                CreateKeyRequest(name="Foo", permissions=PermissionsUpdate()),
                user.id,
            )

        assert await mongo.keys.count_documents({}) == 0
        assert await get_sql_keys(pg) == []


class TestUpdateKey:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Updating permissions is reflected in both MongoDB and PostgreSQL."""
        user = await fake.users.create(
            groups=[
                await fake.groups.create(
                    PermissionsUpdate(create_sample=True, modify_subtraction=True),
                ),
            ],
        )

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(
                name="Foo", permissions=PermissionsUpdate(create_sample=True)
            ),
            user.id,
        )

        await data_layer.account.update_key(
            user.id,
            api_key.id,
            UpdateKeyRequest(permissions=PermissionsUpdate(modify_subtraction=True)),
        )

        mongo_document = await mongo.keys.find_one({"id": api_key.id})
        assert mongo_document["permissions"]["create_sample"] is True
        assert mongo_document["permissions"]["modify_subtraction"] is True

        sql_keys = await get_sql_keys(pg)
        assert sql_keys[0]["permissions"]["create_sample"] is True
        assert sql_keys[0]["permissions"]["modify_subtraction"] is True

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """Updating a key that does not exist raises ``ResourceNotFoundError``."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.update_key(
                user.id,
                999,
                UpdateKeyRequest(permissions=PermissionsUpdate(create_sample=True)),
            )

    async def test_rollback(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """When the PostgreSQL write fails, the MongoDB permissions update is rolled
        back and both stores keep the original permissions.
        """
        user = await fake.users.create(
            groups=[
                await fake.groups.create(
                    PermissionsUpdate(create_sample=True, modify_subtraction=True),
                ),
            ],
        )

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(
                name="Foo", permissions=PermissionsUpdate(create_sample=True)
            ),
            user.id,
        )

        mocker.patch.object(
            AsyncSession, "commit", side_effect=RuntimeError("postgres down")
        )

        with pytest.raises(RuntimeError, match="postgres down"):
            await data_layer.account.update_key(
                user.id,
                api_key.id,
                UpdateKeyRequest(
                    permissions=PermissionsUpdate(modify_subtraction=True)
                ),
            )

        mongo_document = await mongo.keys.find_one({"id": api_key.id})
        assert mongo_document["permissions"].get("modify_subtraction", False) is False

        sql_keys = await get_sql_keys(pg)
        assert sql_keys[0]["permissions"].get("modify_subtraction", False) is False


class TestDeleteKey:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Deleting a key removes it from both MongoDB and PostgreSQL."""
        user = await fake.users.create()

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Foo", permissions=PermissionsUpdate()),
            user.id,
        )

        await data_layer.account.delete_key(user.id, api_key.id)

        assert await mongo.keys.count_documents({}) == 0
        assert await get_sql_keys(pg) == []

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """Deleting a key that does not exist raises ``ResourceNotFoundError``."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.delete_key(user.id, 999)

    async def test_rollback(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """When the PostgreSQL delete fails, the MongoDB delete is rolled back and the
        key remains in both stores.
        """
        user = await fake.users.create()

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Foo", permissions=PermissionsUpdate()),
            user.id,
        )

        mocker.patch.object(
            AsyncSession, "commit", side_effect=RuntimeError("postgres down")
        )

        with pytest.raises(RuntimeError, match="postgres down"):
            await data_layer.account.delete_key(user.id, api_key.id)

        assert await mongo.keys.count_documents({"id": api_key.id}) == 1
        assert len(await get_sql_keys(pg)) == 1


class TestDeleteKeys:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Deleting all of a user's keys removes only that user's keys from both
        stores, leaving other users' keys intact.
        """
        owner = await fake.users.create()
        other = await fake.users.create()

        await data_layer.account.create_key(
            CreateKeyRequest(name="Owned One", permissions=PermissionsUpdate()),
            owner.id,
        )
        await data_layer.account.create_key(
            CreateKeyRequest(name="Owned Two", permissions=PermissionsUpdate()),
            owner.id,
        )
        _, other_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Other", permissions=PermissionsUpdate()),
            other.id,
        )

        await data_layer.account.delete_keys(owner.id)

        assert await mongo.keys.count_documents({"user.id": owner.id}) == 0

        sql_keys = await get_sql_keys(pg)
        assert [key["id"] for key in sql_keys] == [other_key.id]
        assert sql_keys[0]["user_id"] == other.id

    async def test_rollback(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """When the PostgreSQL delete fails, the MongoDB delete is rolled back and all
        of the user's keys remain in both stores.
        """
        owner = await fake.users.create()

        await data_layer.account.create_key(
            CreateKeyRequest(name="Owned One", permissions=PermissionsUpdate()),
            owner.id,
        )
        await data_layer.account.create_key(
            CreateKeyRequest(name="Owned Two", permissions=PermissionsUpdate()),
            owner.id,
        )

        mocker.patch.object(
            AsyncSession, "commit", side_effect=RuntimeError("postgres down")
        )

        with pytest.raises(RuntimeError, match="postgres down"):
            await data_layer.account.delete_keys(owner.id)

        assert await mongo.keys.count_documents({"user.id": owner.id}) == 2
        assert len(await get_sql_keys(pg)) == 2


class TestGetKeyBySecret:
    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """``get_key_by_secret`` resolves a key by its raw secret value."""
        user = await fake.users.create()

        raw_key, api_key = await data_layer.account.create_key(
            CreateKeyRequest(
                name="Test Key",
                permissions=PermissionsUpdate(create_sample=True),
            ),
            user.id,
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

        raw_key, api_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Test Key", permissions=PermissionsUpdate()),
            user.id,
        )

        result = await data_layer.account.get_key_by_secret(user.id, raw_key)

        assert result.id == api_key.id

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """``get_key_by_secret`` raises ``ResourceNotFoundError`` for an unknown key."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.get_key_by_secret(user.id, "nonexistent_key")
