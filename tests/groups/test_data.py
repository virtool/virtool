import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
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


class TestGet:
    async def test_ok(self, data_layer: DataLayer, fake2: DataFaker, snapshot):
        """
        Ensure the correct group is returned when passed a postgres integer ID
        """
        group = await fake2.groups.create()

        await fake2.users.create(groups=[group])
        await fake2.users.create(groups=[group])

        assert await data_layer.groups.get(group.id) == snapshot

    async def test_not_found(self, data_layer: DataLayer):
        """
        Ensure the correct exception is raised when the group does not exist.
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
            **{"permissions": {"create_sample": True, "modify_subtraction": True}}
        ),
    )

    assert group == snapshot(name="group_added")
    assert group.permissions == Permissions(
        **{
            **generate_base_permissions(),
            "create_sample": True,
            "modify_subtraction": True,
        }
    )
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_added")

    group = await data_layer.groups.update(
        group.id, UpdateGroupRequest(**{"permissions": {"create_sample": False}})
    )
    assert group == snapshot(name="group_removed")
    assert group.permissions == Permissions(
        **{**generate_base_permissions(), "modify_subtraction": True}
    )
    assert await get_row_by_id(pg, SQLGroup, group.id) == snapshot(name="pg_removed")


class TestDelete:
    async def test_ok(self, data_layer: DataLayer, pg: AsyncEngine, fake2):
        """Test that deletion of a group removes it from both databases."""
        user = await fake2.users.create()
        group = await data_layer.groups.create("Test")
        await data_layer.users.update(user.id, UpdateUserRequest(groups=[group.id]))

        async with AsyncSession(pg) as session:
            user_associations = (
                await session.execute(
                    select(SQLUserGroup).where(SQLUserGroup.group_id == group.id)
                )
            ).all()

        assert len(user_associations) == 1

        await data_layer.groups.delete(group.id)

        assert await get_row_by_id(pg, SQLGroup, group.id) is None

        async with AsyncSession(pg) as session:
            users = (
                await session.execute(
                    select(SQLUserGroup).where(SQLUserGroup.group_id == group.id)
                )
            ).all()

        assert len(users) == 0

    async def test_not_found(self, data_layer: DataLayer):
        """Test that a ResourceNotFoundError is raised when the group does not exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.groups.delete(5)
