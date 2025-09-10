import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.filters import props

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.models import GroupMinimal
from virtool.models.roles import AdministratorRole
from virtool.pg.utils import get_row_by_id
from virtool.users.models import UserSearchResult
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUser


class TestFind:
    """Tests for the ``find`` method of the ``Users`` data layer."""

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
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

        await data_layer.users.set_administrator_role(user_1.id, AdministratorRole.BASE)
        await data_layer.users.set_administrator_role(user_2.id, AdministratorRole.FULL)

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


class TestUpdate:
    async def test_groups(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        row = await get_row_by_id(pg, SQLUser, 1)

        assert obj == snapshot_recent(name="obj_1")
        assert row == snapshot_recent(name="pg_1", exclude=props("password"))

        # Update groups, removing one and adding another.
        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(groups=[group_2.id, group_1.id]),
        )

        row = await get_row_by_id(pg, SQLUser, 1)

        assert obj == snapshot_recent(name="obj_2")
        assert row == snapshot_recent(name="pg_2", exclude=props("password"))

        # Remove all groups.
        obj = await data_layer.users.update(user.id, UpdateUserRequest(groups=[]))

        row = await get_row_by_id(pg, SQLUser, 1)

        assert obj == snapshot_recent(name="obj_3")
        assert row.to_dict() == snapshot_recent(name="pg_3", exclude=props("password"))

    async def test_groups_unset_primary(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        row = await get_row_by_id(pg, SQLUser, 1)

        assert obj == snapshot_recent(name="obj")
        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))

    async def test_primary_group_when_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that the primary group is updated when the user is already member of the group."""
        group = await fake.groups.create()
        user = await fake.users.create(groups=[group])

        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(primary_group=group.id),
        )

        row = await get_row_by_id(pg, SQLUser, 1)

        assert obj == snapshot_recent(name="obj")
        assert obj.primary_group == GroupMinimal.parse_obj(group)
        assert row.to_dict() == snapshot_recent(name="pg", exclude=props("password"))

    async def test_primary_group_when_not_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

    async def test_primary_group_switching_between_groups(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test switching primary group from one valid group to another."""
        group_1 = await fake.groups.create()
        group_2 = await fake.groups.create()
        user = await fake.users.create(groups=[group_1, group_2], primary_group=group_1)

        # Verify initial state
        assert user.primary_group.id == group_1.id

        # Switch primary group to group_2
        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(primary_group=group_2.id),
        )

        assert obj == snapshot_recent
        assert obj.primary_group.id == group_2.id

    async def test_update_multiple_fields_together(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test updating password, groups, and primary_group in same request."""
        group_1 = await fake.groups.create()
        group_2 = await fake.groups.create()
        group_3 = await fake.groups.create()
        user = await fake.users.create(groups=[group_1])

        # Update multiple fields at once
        obj = await data_layer.users.update(
            user.id,
            UpdateUserRequest(
                password="new_password123",
                groups=[group_2.id, group_3.id],
                primary_group=group_2.id,
                force_reset=True,
                active=False,
            ),
        )

        assert obj == snapshot_recent
        assert obj.primary_group.id == group_2.id
        assert obj.force_reset is True
        assert obj.active is False
        assert len(obj.groups) == 2

        # Verify the new password works
        assert await data_layer.users.validate_password(user.id, "new_password123")

    async def test_password(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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


class TestResolveLegacyId:
    """Tests for the resolve_legacy_id method."""

    async def test_int_user_id(self, data_layer: DataLayer, fake: DataFaker):
        """Test that integer user IDs are returned as-is."""
        user = await fake.users.create()
        resolved_id = await data_layer.users.resolve_legacy_id(user.id)
        assert resolved_id == user.id

    async def test_legacy_string_id(
        self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine
    ):
        """Test that legacy string IDs are resolved to current integer IDs."""
        # Create a user with a legacy ID
        user = await fake.users.create()
        legacy_id = "legacy_test_user_123"

        # Manually set the legacy_id in the database
        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLUser).where(SQLUser.id == user.id).values(legacy_id=legacy_id)
            )
            await session.commit()

        # Test that resolve_legacy_id returns the current integer ID
        resolved_id = await data_layer.users.resolve_legacy_id(legacy_id)
        assert resolved_id == user.id

    async def test_nonexistent_legacy_id(self, data_layer: DataLayer):
        """Test that resolve_legacy_id raises ResourceNotFoundError for nonexistent legacy ID."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.users.resolve_legacy_id("nonexistent_legacy_id")
