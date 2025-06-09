import asyncio

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion
from syrupy.filters import props

from virtool.account.oas import CreateKeysRequest, UpdateAccountRequest
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.users.pg import SQLUser


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
    mocker.patch("virtool.account.mongo.get_alternate_id", make_mocked_coro("foo_0"))
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
        CreateKeysRequest(
            name="Foo",
            permissions=PermissionsUpdate(create_sample=True, modify_subtraction=True),
        ),
        user.id,
    )

    assert api_key == snapshot(name="data")
    assert await mongo.keys.find_one() == snapshot(name="mongo")


class TestGetKey:
    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """Test that a created key can later be retrieved by its id."""
        user = await fake.users.create()

        _, api_key = await data_layer.account.create_key(
            CreateKeysRequest(
                name="Foo",
                permissions=PermissionsUpdate(
                    create_sample=True,
                    modify_subtraction=True,
                ),
            ),
            user.id,
        )

        assert await data_layer.account.get_key(user.id, api_key.id) == api_key

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """Test that ``ResourceNotFoundError`` is raised when a key id is not found."""
        user = await fake.users.create()

        _, api_key = await data_layer.account.create_key(
            CreateKeysRequest(
                name="Foo",
                permissions=PermissionsUpdate(
                    create_sample=True,
                    modify_subtraction=True,
                ),
            ),
            user.id,
        )

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.get_key(user.id, "foo")


class TestGetKeyBySecret:
    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """Test that a created key can later be retrieved by its secret value."""
        user = await fake.users.create()

        secret, api_key = await data_layer.account.create_key(
            CreateKeysRequest(
                name="Foo",
                permissions=PermissionsUpdate(
                    create_sample=True,
                    modify_subtraction=True,
                ),
            ),
            user.id,
        )

        assert await data_layer.account.get_key_by_secret(user.id, secret) == api_key

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """Test that ``ResourceNotFoundError`` is raised when the key secret is invalid."""
        user = await fake.users.create()

        await data_layer.account.create_key(
            CreateKeysRequest(
                name="Foo",
                permissions=PermissionsUpdate(
                    create_sample=True,
                    modify_subtraction=True,
                ),
            ),
            user.id,
        )

        with pytest.raises(ResourceNotFoundError):
            await data_layer.account.get_key_by_secret(user.id, "foo")


@pytest.mark.parametrize(
    "update",
    [
        UpdateAccountRequest(old_password="hello_world_1", password="hello_world_2"),
        UpdateAccountRequest(email="hello@world.com"),
        UpdateAccountRequest(
            old_password="hello_world_1",
            password="hello_world_2",
            email="hello@world.com",
        ),
    ],
    ids=["password", "email", "password and email"],
)
async def test_update(
    update: UpdateAccountRequest,
    data_layer: DataLayer,
    mongo: Mongo,
    pg: AsyncEngine,
    fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
):
    user = await fake.users.create(password="hello_world_1")

    await data_layer.account.update(
        user.id,
        update,
    )

    (row, document) = await asyncio.gather(
        get_row_by_id(pg, SQLUser, 1),
        mongo.users.find_one({"_id": user.id}),
    )

    assert row == snapshot_recent(name="pg", exclude=props("password"))
    assert document == snapshot_recent(name="mongo", exclude=props("password"))
    assert row.password == document["password"]
