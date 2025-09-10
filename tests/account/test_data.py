import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from virtool.account.oas import CreateKeyRequest
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.users.pg import SQLUser
from virtool.utils import hash_key


@pytest.mark.parametrize(
    "has_permission",
    [True, False],
    ids=["has_permission", "does_not_have_permission"],
)
async def test_create_api_key(
    has_permission: bool,
    data_layer: DataLayer,
    fake: DataFaker,
    mocker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time,
):
    """Test that an API key is created correctly with varying key owner administrator
    status and permissions.
    """
    mocker.patch("virtool.account.data._get_alternate_id", make_mocked_coro("foo_0"))
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
            permissions=PermissionsUpdate(create_sample=True, modify_subtraction=True),
        ),
        user.id,
    )

    assert api_key == snapshot(name="data")
    assert await mongo.keys.find_one() == snapshot(name="mongo")


class TestGetKeyBySecret:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        """Test that get_key_by_secret works with current integer user IDs."""
        user = await fake.users.create()

        raw_key = "test_secret_key"
        hashed_key = hash_key(raw_key)

        await mongo.keys.insert_one(
            {
                "_id": hashed_key,
                "id": "test_key",
                "name": "Test Key",
                "created_at": "2023-01-01T00:00:00.000000Z",
                "permissions": {"create_sample": True},
                "user": {"id": user.id},
                "groups": [],
            },
        )

        result = await data_layer.account.get_key_by_secret(user.id, raw_key)

        assert result.id == "test_key"
        assert result.name == "Test Key"

    async def test_with_legacy_user_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg,
    ):
        """Test that get_key_by_secret works with legacy string user IDs."""
        user = await fake.users.create()

        legacy_id = "legacy_user_abc123"

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLUser)
                .where(SQLUser.id == user.id)
                .values(legacy_id=legacy_id),
            )
            await session.commit()

        raw_key = "test_secret_key"
        hashed_key = hash_key(raw_key)

        await mongo.keys.insert_one(
            {
                "_id": hashed_key,
                "id": "test_key",
                "name": "Test Key",
                "created_at": "2023-01-01T00:00:00.000000Z",
                "permissions": {"create_sample": True},
                "user": {"id": legacy_id},
                "groups": [],
            },
        )

        result = await data_layer.account.get_key_by_secret(user.id, raw_key)

        assert result.id == "test_key"
        assert result.name == "Test Key"

    async def test_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that get_key_by_secret raises ResourceNotFoundError when key doesn't exist."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.get_key_by_secret(user.id, "nonexistent_key")
