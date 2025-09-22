import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.filters import props

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.models import GroupMinimal
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.users.models import UserSearchResult
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUser
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestFind:
    """Tests for the ``find`` method of the ``Users`` data layer."""

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        authorization_client: AuthorizationClient,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        group_1 = await fake.groups.create()
        group_2 = await fake.groups.create()

        self.users = [
            await fake.users.create(
                handle="fred",
                groups=[group_1, group_2],
                primary_group=group_1,
            ),
            await fake.users.create(),
            await fake.users.create(),
            # The sort should be case-insensitive, and we expect to find Adam first.
            await fake.users.create(handle="Adam"),
            # This user should be filtered by the `active` parameter.
            await fake.users.create(),
        ]

        user_1, user_2, _, _, user_5 = self.users

        await data_layer.users.update(user_5.id, UpdateUserRequest(active=False))

        await authorization_client.add(
            AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
            AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
        )

    async def test_active(
        self,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that only active users are returned when the `active` parameter is set
        to `True`.
        """
        result = await data_layer.users.find(1, 25, False, None, "")
        assert result.total_count == 5
        assert result.found_count == 1
        assert result == snapshot_recent

    @pytest.mark.parametrize("term", ["fre", "ada"])
    async def test_term(
        self,
        term: str,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that only matching (case-insensitive) records are returned when a handle
        is provided.
        """
        result = await data_layer.users.find(1, 25, True, None, term)
        assert result.total_count == 5
        assert result.found_count == 1
        assert result == snapshot_recent

    async def test_no_term(
        self,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that all users are returned when no term is provided."""
        result = await data_layer.users.find(1, 25, True, None, "")
        assert result.total_count == 5
        assert result.found_count == 4
        assert result == snapshot_recent

    async def test_handle_doesnt_exist(self, data_layer: DataLayer):
        """Test that no items are returned when the queried handle doesn't exist."""
        assert await data_layer.users.find(
            1,
            25,
            True,
            None,
            "missing-handle",
        ) == UserSearchResult(
            found_count=0,
            page=1,
            page_count=0,
            per_page=25,
            total_count=5,
            items=[],
        )


class TestCreate:
    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test basic user creation with valid data."""
        user = await data_layer.users.create(
            handle="testuser",
            password="test_password123",
        )

        assert user == snapshot_recent(exclude=props("id"))
        assert user.force_reset is False
        assert user.active is True
        assert user.administrator_role is None

    async def test_already_exists(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that an error is raised when a user with the same handle already exists."""
        user = await fake.users.create()

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.users.create(password="hello_world", handle=user.handle)

        assert "User already exists" in str(err.value)

    async def test_first(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        user = await data_layer.users.create_first(
            password="hello_world",
            handle="bill",
        )

        row = await get_row_by_id(pg, SQLUser, 1)

        assert user == snapshot_recent(
            exclude=props(
                "id",
            ),
        )

        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))


class TestUpdate:
    async def test_groups(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that updating `groups` works as expected."""
        user = await fake.users.create()

        group_1 = await fake.groups.create()
        group_2 = await fake.groups.create()
        group_3 = await fake.groups.create()

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
            user.id,
            UpdateUserRequest(groups=[group_2.id, group_1.id]),
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}),
            get_row_by_id(pg, SQLUser, 1),
        )

        assert obj == snapshot_recent(name="obj_2")
        assert doc == snapshot_recent(name="mongo_2", exclude=props("password"))
        assert row == snapshot_recent(name="pg_2", exclude=props("password"))

        # Remove all groups.
        obj = await data_layer.users.update(user.id, UpdateUserRequest(groups=[]))

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}),
            get_row_by_id(pg, SQLUser, 1),
        )

        assert obj == snapshot_recent(name="obj_3")
        assert doc == snapshot_recent(name="mongo_3", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg_3", exclude=props("password"))

    async def test_groups_unset_primary(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that the primary group is unset when the user is removed from the group."""
        group = await fake.groups.create()
        user = await fake.users.create(groups=[group], primary_group=group)

        assert user.primary_group == GroupMinimal.parse_obj(group)

        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(groups=[]),
        )

        assert obj.primary_group is None

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}),
            get_row_by_id(pg, SQLUser, 1),
        )

        assert obj == snapshot_recent(name="obj")
        assert doc == snapshot_recent(name="mongo", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))

    async def test_primary_group_when_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        mongo: Mongo,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that the primary group is updated when the user is already member of the group."""
        group = await fake.groups.create()
        user = await fake.users.create(groups=[group])

        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(primary_group=group.id),
        )

        doc, row = await asyncio.gather(
            mongo.users.find_one({"_id": user.id}),
            get_row_by_id(pg, SQLUser, 1),
        )

        assert obj == snapshot_recent(name="obj")
        assert obj.primary_group == GroupMinimal.parse_obj(group)
        assert doc == snapshot_recent(name="mongo", exclude=props("password"))
        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))

    async def test_primary_group_when_not_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        mongo: Mongo,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that the call fails when the user is not a member of the primary group in
        the update.
        """
        group = await fake.groups.create()
        user = await fake.users.create()

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.users.update(
                user.id,
                UpdateUserRequest(primary_group=group.id),
            )

        assert str(err.value) == "User is not a member of group"

    async def test_primary_group_does_not_exist(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that the call fails when the primary group does not exist."""
        user = await fake.users.create()

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.users.update(
                user.id,
                UpdateUserRequest(primary_group=3),
            )

        assert str(err.value) == "User is not a member of group"

    async def test_password(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that updating the user's password works as expected."""
        group = await fake.groups.create()
        user = await fake.users.create(groups=[group])

        assert await data_layer.users.update(
            user.id,
            UpdateUserRequest(password="hello_world"),
        ) == snapshot_recent(name="obj")

        assert await mongo.users.find_one() == snapshot_recent(
            name="db",
            exclude=props("password"),
        )

        async with AsyncSession(pg) as session:
            row = await session.get(SQLUser, 1)

            assert row.to_dict() == snapshot_recent(
                name="pg",
                exclude=props("password"),
            )

        # Ensure the newly set password validates.
        assert await data_layer.users.validate_password(user.id, "hello_world")

    async def test_not_found(self, data_layer: DataLayer):
        with pytest.raises(ResourceNotFoundError):
            await data_layer.users.update(
                99999,
                UpdateUserRequest(groups=[]),
            )


class TestCheckUsersExist:
    async def test_no_users_exist(self, data_layer: DataLayer):
        """Verify that the user existence check returns False when no users exist."""
        assert not await data_layer.users.check_users_exist()

    async def test_users_exist(self, data_layer: DataLayer):
        """Verify that the user existence check returns True when users exist."""
        await data_layer.users.create(password="hello_world", handle="bill")
        assert await data_layer.users.check_users_exist()


class TestSetAdministratorRole:
    """Tests for the set_administrator_role method (interface tests)."""

    @pytest.mark.parametrize(
        "role",
        [AdministratorRole.BASE, AdministratorRole.USERS, AdministratorRole.FULL, None],
    )
    async def test_ok(
        self,
        role: AdministratorRole | None,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that set_administrator_role updates user roles correctly."""
        user = await fake.users.create()

        # Test setting the role
        updated_user = await data_layer.users.set_administrator_role(user.id, role)
        assert updated_user.administrator_role == role

        # Test persistence - retrieve the user again to verify role was stored
        retrieved_user = await data_layer.users.get(user.id)
        assert retrieved_user.administrator_role == role

    async def test_not_found(self, data_layer: DataLayer):
        """Test that set_administrator_role raises error for non-existent user."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.users.set_administrator_role(99999, AdministratorRole.BASE)
