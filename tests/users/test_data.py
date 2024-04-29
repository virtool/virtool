import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.filters import props
from syrupy.matchers import path_type
from virtool_core.models.group import GroupMinimal
from virtool_core.models.roles import AdministratorRole

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.users.db import B2CUserAttributes
from virtool.users.mongo import validate_credentials
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUser


@pytest.mark.parametrize("term", [None, "test_user", "missing-handle"])
@pytest.mark.parametrize("administrator", [True, False, None])
async def test_find(
    term: str | None,
    administrator: bool | None,
    authorization_client: AuthorizationClient,
    data_layer: DataLayer,
    fake2: DataFaker,
    snapshot: SnapshotAssertion,
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


class TestCreate:
    @pytest.mark.parametrize(
        "force_reset", [None, True, False], ids=["not_specified", "true", "false"]
    )
    async def test_force_reset(
        self,
        force_reset: bool | None,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        if force_reset is None:
            user = await data_layer.users.create(password="hello_world", handle="bill")
        else:
            user = await data_layer.users.create(
                force_reset=force_reset, handle="bill", password="hello_world"
            )

        row, doc = await asyncio.gather(
            get_row_by_id(pg, SQLUser, 1), mongo.users.find_one({"_id": user.id})
        )

        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))
        assert user == snapshot_recent(
            name="obj",
            exclude=props(
                "id",
            ),
        )
        assert doc == snapshot_recent(name="mongo", exclude=props("password"))
        assert (
            doc["force_reset"]
            == row.force_reset
            == user.force_reset
            is bool(force_reset)
        )
        assert doc["password"] == row.password

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

    async def test_first(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        user = await data_layer.users.create_first(
            password="hello_world", handle="bill"
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert user == snapshot_recent(
            exclude=props(
                "id",
            )
        )

        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))
        assert doc == snapshot_recent(name="mongo", exclude=props("password"))
        assert doc["password"] == row.password


class TestUpdate:
    async def test_force_reset(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """
        Test that setting and unsetting ``force_reset`` works as expected.
        """
        user = await fake2.users.create()

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert doc["force_reset"] == row.force_reset == user.force_reset is False
        assert doc == snapshot_recent(name="mongo_1", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg_1", exclude=props("password"))

        user = await data_layer.users.update(
            user.id, UpdateUserRequest(force_reset=True)
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert doc["force_reset"] == row.force_reset == user.force_reset is True
        assert doc == snapshot_recent(name="mongo_2", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg_2", exclude=props("password"))

        user = await data_layer.users.update(
            user.id, UpdateUserRequest(force_reset=False)
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert doc["force_reset"] == row.force_reset == user.force_reset is False
        assert doc == snapshot_recent(name="mongo_3", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg_3", exclude=props("password"))

    async def test_groups(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that updating `groups` works as expected."""

        user = await fake2.users.create()

        group_1 = await fake2.groups.create()
        group_2 = await fake2.groups.create()
        group_3 = await fake2.groups.create()

        # Set initial groups.
        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(groups=[group_1.id, group_3.id]),
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}),
            get_row_by_id(pg, SQLUser, 1),
        )

        assert obj == snapshot_recent(name="obj_1")
        assert doc == snapshot_recent(name="mongo_1", exclude=props("password"))
        assert row == snapshot_recent(name="pg_1", exclude=props("password"))

        # Update groups, removing one and adding another.
        obj = await data_layer.users.update(
            user.id, UpdateUserRequest(groups=[group_2.id, group_1.id])
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert obj == snapshot_recent(name="obj_2")
        assert doc == snapshot_recent(name="mongo_2", exclude=props("password"))
        assert row == snapshot_recent(name="pg_2", exclude=props("password"))

        # Remove all groups.
        obj = await data_layer.users.update(user.id, UpdateUserRequest(groups=[]))

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert obj == snapshot_recent(name="obj_3")
        assert doc == snapshot_recent(name="mongo_3", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg_3", exclude=props("password"))

    async def test_groups_unset_primary(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """
        Test that the primary group is unset when the user is removed from the group.
        """
        group = await fake2.groups.create()
        user = await fake2.users.create(groups=[group], primary_group=group)

        assert user.primary_group == GroupMinimal.parse_obj(group)

        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(groups=[]),
        )

        assert obj.primary_group is None

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert obj == snapshot_recent(name="obj")
        assert doc == snapshot_recent(name="mongo", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))

    async def test_primary_group_when_member(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        pg: AsyncEngine,
        mongo: Mongo,
        snapshot_recent: SnapshotAssertion,
    ):
        """
        Test that the primary group is updated when the user is already member of the group.
        """

        group = await fake2.groups.create()
        user = await fake2.users.create(groups=[group])

        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(primary_group=group.id),
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}), get_row_by_id(pg, SQLUser, 1)
        )

        assert obj == snapshot_recent(name="obj")
        assert obj.primary_group == GroupMinimal.parse_obj(group)
        assert doc == snapshot_recent(name="mongo", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))

    async def test_primary_group_when_not_member(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        pg: AsyncEngine,
        mongo: Mongo,
        snapshot_recent: SnapshotAssertion,
    ):
        """
        Test that the call fails when the user is not a member of the primary group in
        the update.
        """

        group = await fake2.groups.create()
        user = await fake2.users.create()

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.users.update(
                user.id,
                UpdateUserRequest(primary_group=group.id),
            )

        assert str(err.value) == "User is not member of primary group"

    async def test_primary_group_does_not_exist(
        self, data_layer: DataLayer, fake2: DataFaker
    ):
        """Test that the call fails when the primary group does not exist."""

        user = await fake2.users.create()

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.users.update(
                user.id,
                UpdateUserRequest(primary_group=3),
            )

        assert str(err.value) == "Non-existent group: 3"

    async def test_password(
        self,
        data_layer: DataLayer,
        fake2: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that updating the user's password works as expected."""
        group = await fake2.groups.create()
        user = await fake2.users.create(groups=[group])

        assert await data_layer.users.update(
            user.id, UpdateUserRequest(password="hello_world")
        ) == snapshot_recent(name="obj")

        assert await mongo.users.find_one() == snapshot_recent(
            name="db", exclude=props("password")
        )

        async with AsyncSession(pg) as session:
            row = await session.get(SQLUser, 1)

            assert row.to_dict() == snapshot_recent(
                name="pg", exclude=props("password")
            )

        # Ensure the newly set password validates.
        assert await validate_credentials(mongo, user.id, "hello_world")

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
    snapshot: SnapshotAssertion,
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
        """Verify that the user existence check returns False when no users exist."""
        assert not await data_layer.users.check_users_exist()

    async def test_users_exist(self, data_layer: DataLayer):
        """Verify that the user existence check returns True when users exist."""
        await data_layer.users.create(password="hello_world", handle="bill")
        assert await data_layer.users.check_users_exist()


@pytest.mark.parametrize("role", [None, AdministratorRole.BASE, AdministratorRole.FULL])
async def test_set_administrator_role(
    role: AdministratorRole | None,
    authorization_client: AuthorizationClient,
    data_layer: DataLayer,
    fake2: DataFaker,
    snapshot: SnapshotAssertion,
    static_time,
):
    """
    Test changing the administrator role of a user.

    """
    user = await fake2.users.create()

    assert await data_layer.users.set_administrator_role(user.id, role) == snapshot(
        name="obj"
    )

    assert await authorization_client.list_administrators() == (
        [(user.id, role)] if role is not None else []
    )
