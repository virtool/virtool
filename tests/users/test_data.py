import re
from asyncio import gather
from datetime import datetime


import pytest
from syrupy.filters import props
from syrupy.matchers import path_type

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.users.data import UsersData
from virtool.users.db import validate_credentials, B2CUserAttributes
from virtool.users.oas import UpdateUserSchema


@pytest.fixture
def users_data(dbi, pg):
    return UsersData(dbi, pg)


class TestCreate:
    async def test_no_force_reset(self, mocker, snapshot, users_data):
        mocker.patch(
            "virtool.users.utils.hash_password", return_value="hashed_password"
        )

        user = await users_data.create(password="hello_world", handle="bill")

        assert user.force_reset is False
        assert user == snapshot(
            exclude=props(
                "id",
            ),
            matcher=path_type({"last_password_change": (datetime,)}),
        )

    @pytest.mark.parametrize("force_reset", [True, False])
    async def test_force_reset(self, force_reset, mocker, snapshot, users_data):
        mocker.patch(
            "virtool.users.utils.hash_password", return_value="hashed_password"
        )

        user = await users_data.create(
            force_reset=force_reset, password="hello_world", handle="bill"
        )

        assert user.force_reset == force_reset
        assert user == snapshot(
            exclude=props(
                "id",
            ),
            matcher=path_type({"last_password_change": (datetime,)}),
        )

    async def test_already_exists(self, fake, users_data):
        user = await fake.users.insert()

        with pytest.raises(ResourceConflictError) as err:
            await users_data.create(password="hello_world", handle=user["handle"])
            assert "User already exists" in str(err)


class TestUpdate:
    @pytest.mark.parametrize(
        "update",
        [
            UpdateUserSchema(administrator=True),
            UpdateUserSchema(force_reset=True),
            UpdateUserSchema(groups=["peasants", "kings"], primary_group="peasants"),
        ],
        ids=[
            "administrator",
            "force_reset",
            "groups",
        ],
    )
    async def test(
        self,
        all_permissions,
        bob,
        dbi,
        no_permissions,
        snapshot,
        static_time,
        update,
        users_data,
    ):
        """
        Ensure updates are applied correctly.

        """
        await gather(
            dbi.users.insert_one(bob),
            dbi.groups.insert_many(
                [
                    {
                        "_id": "peasants",
                        "permissions": {**no_permissions, "create_sample": True},
                    },
                    {
                        "_id": "kings",
                        "permissions": {**no_permissions, "create_ref": True},
                    },
                ]
            ),
        )

        assert await users_data.update(bob["_id"], update) == snapshot(name="obj")
        assert await dbi.users.find_one() == snapshot(name="db")

    async def test_password(self, bob, dbi, snapshot, users_data):
        """
        Test editing an existing user.

        """
        await dbi.users.insert_one(bob)

        assert await users_data.update(
            bob["_id"], UpdateUserSchema(password="hello_world")
        ) == snapshot(name="obj")

        document = await dbi.users.find_one()

        assert document == snapshot(name="db", exclude=props("password"))

        # Ensure the newly set password validates.
        assert await validate_credentials(dbi, bob["_id"], "hello_world")

    async def test_does_not_exist(self, users_data: UsersData):
        with pytest.raises(ResourceNotFoundError) as err:
            await users_data.update("user_id", UpdateUserSchema(administrator=False))
            assert "User does not exist" == str(err)


class TestDelete:
    async def test(self, dbi, fake, snapshot, users_data):
        user = await fake.users.insert()

        await dbi.references.insert_many(
            [
                {"_id": "foo", "users": [{"id": user["_id"]}, {"id": "bob"}]},
                {"_id": "bar", "users": [{"id": user["_id"]}]},
            ]
        )

        assert await dbi.users.count_documents({}) == 1

        await users_data.delete(user["_id"])

        assert await dbi.users.count_documents({}) == 0

        assert await dbi.references.find().to_list(None) == snapshot


@pytest.mark.parametrize("exists", [True, False])
async def test_find_or_create_b2c_user(
    exists, dbi, fake, snapshot, static_time, users_data
):
    if exists:
        await dbi.users.insert_one(
            {
                **await fake.users.create(),
                "_id": "foobar",
                "last_password_change": static_time.datetime,
                "force_reset": False,
                "b2c_oid": "abc123",
                "b2c_given_name": "Bilbo",
                "b2c_family_name": "Baggins",
                "b2c_display_name": "Bilbo",
            }
        )

    user = await users_data.find_or_create_b2c_user(
        B2CUserAttributes(
            oid="abc123",
            display_name="Fred",
            given_name="Fred",
            family_name="Smith",
        )
    )

    assert user == snapshot(exclude=props("id", "handle"))

    if exists:
        assert user.id == "foobar"
    else:
        assert re.match(r"[a-z\d]{8}", user.id)
        assert re.match(r"Fred-Smith-\d+", user.handle)
