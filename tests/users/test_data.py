import datetime

import pytest
from syrupy.filters import props
from syrupy.matchers import path_type
from virtool_core.models.roles import AdministratorRole

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.users.db import B2CUserAttributes
from virtool.users.mongo import validate_credentials
from virtool.users.oas import UpdateUserRequest

_last_password_change_matcher = path_type(
    {"last_password_change": (datetime.datetime,)}
)


class TestCreate:
    async def test_no_force_reset(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
    ):
        user = await data_layer.users.create(password="hello_world", handle="bill")

        assert user.force_reset is False
        assert user == snapshot(
            exclude=props(
                "id",
            ),
            matcher=_last_password_change_matcher,
        )
        assert await mongo.users.find_one({"_id": user.id}) == snapshot(
            name="mongo",
            exclude=props("password"),
            matcher=_last_password_change_matcher,
        )

    @pytest.mark.parametrize("force_reset", [True, False])
    async def test_force_reset(
        self, force_reset: bool, data_layer: DataLayer, mocker, snapshot
    ):
        mocker.patch(
            "virtool.users.utils.hash_password", return_value="hashed_password"
        )

        user = await data_layer.users.create(
            force_reset=force_reset, password="hello_world", handle="bill"
        )

        assert user.force_reset == force_reset
        assert user == snapshot(
            exclude=props(
                "id",
            ),
            matcher=_last_password_change_matcher,
        )

    async def test_already_exists(
        self, data_layer: DataLayer, fake2: DataFaker, mongo: Mongo
    ):
        """
        Test that an error is raised when a user with the same handle already exists.
        """
        await mongo.users.create_index("handle", unique=True, sparse=True)

        user = await fake2.users.create()

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.users.create(password="hello_world", handle=user.handle)
            assert "User already exists" in str(err)


class TestUpdate:
    @pytest.mark.parametrize("is_administrator", [True, False])
    async def test_administrator(
        self,
        is_administrator: bool,
        authorization_client: AuthorizationClient,
        data_layer: DataLayer,
        fake2: DataFaker,
        mongo: Mongo,
        snapshot,
    ):
        """
        Test that setting a user to administrator and vice versa sets the legacy
        ``administrator`` flag and gives them the ``AdministratorRole.FULL`` role.
        """
        user = await fake2.users.create(administrator_role=AdministratorRole.FULL)

        assert await data_layer.users.update(
            user.id, UpdateUserRequest(administrator=not is_administrator)
        ) == snapshot(
            name="obj",
            matcher=_last_password_change_matcher,
        )

        assert await mongo.users.find_one() == snapshot(
            name="mongo",
            exclude=props("password"),
            matcher=_last_password_change_matcher,
        )

        assert (
            await authorization_client.list_administrators() == []
            if is_administrator
            else [(user.id, "full")]
        )

    async def test_force_reset(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        mongo: Mongo,
    ):
        """
        Test that setting and unsetting ``force_reset`` works as expected.
        """
        user = await fake2.users.create()

        assert await get_one_field(mongo.users, "force_reset", user.id) is False

        user = await data_layer.users.update(
            user.id, UpdateUserRequest(force_reset=True)
        )

        assert user.force_reset is True
        assert await get_one_field(mongo.users, "force_reset", user.id) is True

        user = await data_layer.users.update(
            user.id, UpdateUserRequest(force_reset=False)
        )

        assert user.force_reset is False
        assert await get_one_field(mongo.users, "force_reset", user.id) is False

    async def test_set_groups(
        self, data_layer: DataLayer, fake2: DataFaker, mongo: Mongo, snapshot
    ):
        """
        Test that setting ``groups`` works as expected.
        """
        group_1 = await fake2.groups.create()
        group_2 = await fake2.groups.create()

        user = await fake2.users.create()
        document = await mongo.users.find_one({"_id": user.id})

        assert user == snapshot(name="obj_1", matcher=_last_password_change_matcher)
        assert document == snapshot(
            name="mongo_1",
            exclude=props("password"),
            matcher=_last_password_change_matcher,
        )
        assert user.groups == []

        user = await data_layer.users.update(
            user.id, UpdateUserRequest(groups=[group_2.id])
        )
        document = await mongo.users.find_one({"_id": user.id})

        assert user == snapshot(name="obj_2", matcher=_last_password_change_matcher)
        assert document == snapshot(
            name="mongo_2",
            exclude=props("password"),
            matcher=_last_password_change_matcher,
        )
        assert document["groups"] == [group_2.id]

        user = await data_layer.users.update(
            user.id, UpdateUserRequest(groups=[group_2.id, group_1.id])
        )
        document = await mongo.users.find_one({"_id": user.id})

        assert user == snapshot(name="obj_3", matcher=_last_password_change_matcher)
        assert document == snapshot(
            name="mongo_3",
            exclude=props("password"),
            matcher=_last_password_change_matcher,
        )
        assert document["groups"] == [
            group_2.id,
            group_1.id,
        ]

        user = await data_layer.users.update(user.id, UpdateUserRequest(groups=[]))
        document = await mongo.users.find_one({"_id": user.id})

        assert user == snapshot(name="obj_4", matcher=_last_password_change_matcher)
        assert document == snapshot(
            name="mongo_4",
            exclude=props("password"),
            matcher=_last_password_change_matcher,
        )
        assert document["groups"] == []

    async def test_password(self, bob, data_layer: DataLayer, mongo: Mongo, snapshot):
        """
        Test editing an existing user.

        """
        await mongo.users.insert_one(bob)

        assert await data_layer.users.update(
            bob["_id"], UpdateUserRequest(password="hello_world")
        ) == snapshot(name="obj")

        assert await mongo.users.find_one() == snapshot(
            name="db", exclude=props("password")
        )

        # Ensure the newly set password validates.
        assert await validate_credentials(mongo, bob["_id"], "hello_world")

    async def test_not_found(self, data_layer: DataLayer):
        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.users.update(
                "user_id", UpdateUserRequest(administrator=False)
            )

        assert "User does not exist" == str(err.value)


@pytest.mark.parametrize("exists", [True, False])
async def test_find_or_create_b2c_user(
    exists: bool,
    data_layer: DataLayer,
    fake2: DataFaker,
    mongo: Mongo,
    snapshot,
    static_time,
):
    fake_user = await fake2.users.create()

    await mongo.users.update_one(
        {"_id": fake_user.id},
        {
            "$set": {
                "last_password_change": static_time.datetime,
                "force_reset": False,
                "b2c_oid": "abc123" if exists else "def456",
                "b2c_given_name": "Bilbo",
                "b2c_family_name": "Baggins",
                "b2c_display_name": "Bilbo",
            }
        },
    )

    user = await data_layer.users.find_or_create_b2c_user(
        B2CUserAttributes(
            oid="abc123",
            display_name="Fred",
            given_name="Fred",
            family_name="Smith",
        )
    )

    if not exists:
        assert "Fred-Smith" in user.handle
        # Make sure handle ends with integer.
        assert int(user.handle.split("-")[-1])

    assert user == snapshot(matcher=path_type({"handle": (str,)}))


class TestCheckUsersExist:
    async def test_no_users_exist(self, data_layer: DataLayer):
        """
        Verify that the user existence check returns False when no users exist.
        """
        assert not await data_layer.users.check_users_exist()

    async def test_users_exist(self, data_layer: DataLayer):
        """
        Verify that the user existence check returns True when users exist.
        """
        await data_layer.users.create(password="hello_world", handle="bill")
        assert await data_layer.users.check_users_exist()


@pytest.mark.parametrize("role", [None, AdministratorRole.BASE, AdministratorRole.FULL])
async def test_set_administrator_role(
    role: AdministratorRole | None,
    authorization_client: AuthorizationClient,
    data_layer: DataLayer,
    fake2: DataFaker,
    mongo: Mongo,
    snapshot,
    static_time,
):
    """
    Test changing the administrator role of a user.

    """
    user = await fake2.users.create()

    assert await data_layer.users.set_administrator_role(user.id, role) == snapshot(
        name="obj"
    )

    assert await get_one_field(mongo.users, "administrator", user.id) == (
        role == AdministratorRole.FULL
    )

    assert await authorization_client.list_administrators() == (
        [(user.id, role)] if role is not None else []
    )


@pytest.mark.parametrize("term", [None, "test_user", "missing-handle"])
@pytest.mark.parametrize("administrator", [True, False, None])
async def test_find_users(
    term: str | None,
    administrator: bool | None,
    authorization_client: AuthorizationClient,
    data_layer: DataLayer,
    fake2: DataFaker,
    snapshot,
    static_time,
):
    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create()

    user_1 = await fake2.users.create(
        handle="test_user", groups=[group_1, group_2], primary_group=group_1
    )
    user_2 = await fake2.users.create()
    await fake2.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
    )

    assert (
        await data_layer.users.find(1, 25, term=term, administrator=administrator)
        == snapshot
    )
