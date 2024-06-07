import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from virtool_core.models.group import Permissions

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.pg.utils import get_row_by_id
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUserGroup
from virtool.users.utils import generate_base_permissions


async def test_list(
        data_layer: DataLayer, fake: DataFaker, snapshot: SnapshotAssertion,
):
    """Test that the method lists all groups in the instance."""
    for _ in range(10):
        await fake.groups.create()

    assert await data_layer.groups.list() == snapshot


class TestFind:
    @pytest.mark.parametrize("page", [1, 2])
    async def test_pages(
        self,
        page: int,
        data_layer: DataLayer,
            fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that the correct page of groups and the correct search metadata values
        are returned when `page` is `1` or `2`.
        """
        for _ in range(15):
            await fake.groups.create()

        result = await data_layer.groups.find(page, 10)
        assert result.items == snapshot_recent
        assert result.found_count == 15
        assert result.page == page
        assert result.page_count == 2
        assert result.per_page == 10
        assert result.total_count == 15

    @pytest.mark.parametrize("term", ["", "te", "re", "1", "2"])
    async def test_search(
        self,
        term: str,
        data_layer: DataLayer,
            fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that only matching groups are returned when a search term is provided."""
        await data_layer.groups.create("test 1")
        await data_layer.groups.create("test 2")

        assert await data_layer.groups.find(1, 25, term) == snapshot_recent


class TestGet:
    async def test_ok(self, data_layer: DataLayer, fake: DataFaker, snapshot):
        """Ensure the correct group is returned when passed a postgres integer ID
        """
        group = await fake.groups.create()

        await fake.users.create(groups=[group])
        await fake.users.create(groups=[group])

        assert await data_layer.groups.get(group.id) == snapshot

    async def test_not_found(self, data_layer: DataLayer):
        """Ensure the correct exception is raised when the group does not exist.
        """
        with pytest.raises(ResourceNotFoundError):
            await data_layer.groups.get(5)


class TestCreate:
    async def test_ok(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        snapshot,
    ):
        group = await data_layer.groups.create("Test")

        assert group == snapshot(name="group")
        assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg")

    async def test_duplicate(self, data_layer: DataLayer):
        """Test that a group cannot be created with a name that already exists."""
        group = await data_layer.groups.create("Test")

        with pytest.raises(ResourceConflictError):
            await data_layer.groups.create(group.name)


async def test_update_name(
    data_layer: DataLayer,
    pg: AsyncEngine,
    snapshot,
):
    group = await data_layer.groups.create("Test")

    assert group.name == "Test"
    assert group == snapshot(name="group_before")
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_before")

    group = await data_layer.groups.update(group.id, UpdateGroupRequest(name="Renamed"))

    assert group.name == "Renamed"
    assert group == snapshot(name="group_after")
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_after")


async def test_update_permissions(
    data_layer: DataLayer,
    pg: AsyncEngine,
    snapshot,
):
    group = await data_layer.groups.create("Test")

    assert group == snapshot(name="group_before")
    assert group.permissions == Permissions(**generate_base_permissions())
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_before")

    group = await data_layer.groups.update(
        group.id,
        UpdateGroupRequest(
            permissions={"create_sample": True, "modify_subtraction": True},
        ),
    )

    assert group == snapshot(name="group_added")
    assert group.permissions == Permissions(
        **{
            **generate_base_permissions(),
            "create_sample": True,
            "modify_subtraction": True,
        },
    )
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_added")

    group = await data_layer.groups.update(
        group.id, UpdateGroupRequest(permissions={"create_sample": False}),
    )
    assert group == snapshot(name="group_removed")
    assert group.permissions == Permissions(
        **{**generate_base_permissions(), "modify_subtraction": True},
    )
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_removed")


class TestDelete:
    async def test_ok(self, data_layer: DataLayer, pg: AsyncEngine, fake):
        """Test that deletion of a group removes it from both databases."""
        user = await fake.users.create()
        group = await data_layer.groups.create("Test")
        await data_layer.users.update(user.id, UpdateUserRequest(groups=[group.id]))

        async with AsyncSession(pg) as session:
            user_associations = (
                await session.execute(
                    select(SQLUserGroup).where(SQLUserGroup.group_id == group.id),
                )
            ).all()

        assert len(user_associations) == 1

        await data_layer.groups.delete(group.id)

        assert await get_row_by_id(pg, SQLGroup, group.id) is None

        async with AsyncSession(pg) as session:
            users = (
                await session.execute(
                    select(SQLUserGroup).where(SQLUserGroup.group_id == group.id),
                )
            ).all()

        assert len(users) == 0

    async def test_not_found(self, data_layer: DataLayer):
        """Test that a ResourceNotFoundError is raised when the group does not exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.groups.delete(5)
