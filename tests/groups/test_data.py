import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.data import GroupsData
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id


async def test_create(
    data_layer: DataLayer,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot,
):
    group = await data_layer.groups.create("test")
    row = await get_row_by_id(pg, SQLGroup, 1)
    doc = await mongo.groups.find_one()

    assert doc == snapshot(name="mongo")
    assert row == snapshot(name="pg")

    assert doc["name"] == group.name == row.name
    assert doc["permissions"] == group.permissions == row.permissions
    assert doc["_id"] == group.id == row.legacy_id


class TestGet:
    async def test_get(self, data_layer: DataLayer, fake2: DataFaker, snapshot):
        """
        Ensure the correct group is returned when passed a postgres integer ID
        """
        group = await fake2.groups.create()
        assert await data_layer.groups.get(group.id) == snapshot

    async def test_legacy_id(self, data_layer: DataLayer, fake2: DataFaker, snapshot):
        """
        Ensure the correct group is returned when passed a legacy mongo id
        """
        group = await fake2.groups.create()
        assert await data_layer.groups.get(group.id) == snapshot

    async def test_user(self, data_layer: DataLayer, fake2: DataFaker, snapshot):
        """
        Ensure that users are correctly attached to the returned groups
        """
        group = await fake2.groups.create()
        await fake2.users.create(groups=[group])

        assert await data_layer.groups.get(group.id) == snapshot

    @pytest.mark.parametrize("group_id", ["group_dne", 0xBEEF])
    async def test_group_dne(self, data_layer: DataLayer, group_id: str | int):
        """
        Ensure the correct exception is raised when the group does not exist
        using either a postgres or mongo id
        """
        with pytest.raises(ResourceNotFoundError):
            await data_layer.groups.get(group_id)


async def test_create_duplicate(data_layer: DataLayer):
    """Test that a group cannot be created with a name that already exists."""
    group = await data_layer.groups.create("test")

    with pytest.raises(ResourceConflictError):
        await data_layer.groups.create(group.name)


async def test_update_name(
    data_layer: DataLayer,
    mongo: Mongo,
    pg: AsyncEngine,
):
    group = await data_layer.groups.create("Test")

    document, row = await asyncio.gather(
        mongo.groups.find_one(), get_row_by_id(pg, SQLGroup, 1)
    )

    assert document["name"] == row.name == "Test" == group.name

    group = await data_layer.groups.update(group.id, UpdateGroupRequest(name="Renamed"))

    document, row = await asyncio.gather(
        mongo.groups.find_one(), get_row_by_id(pg, SQLGroup, 1)
    )

    assert document["name"] == row.name == "Renamed" == group.name


async def test_update_permissions(
    data_layer: DataLayer,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot,
):
    group = await data_layer.groups.create("Test")

    group = await data_layer.groups.update(
        group.id,
        UpdateGroupRequest(
            **{"permissions": {"create_sample": True, "modify_subtraction": True}}
        ),
    )

    doc, row = await asyncio.gather(
        mongo.groups.find_one(), get_row_by_id(pg, SQLGroup, 1)
    )

    assert (
        group.permissions
        == row.permissions
        == doc["permissions"]
        == snapshot(name="mongo_added")
    )

    group = await data_layer.groups.update(
        group.id, UpdateGroupRequest(**{"permissions": {"create_sample": False}})
    )

    doc, row = await asyncio.gather(
        mongo.groups.find_one(), get_row_by_id(pg, SQLGroup, 1)
    )

    assert (
        group.permissions
        == row.permissions
        == doc["permissions"]
        == snapshot(name="mongo_removed")
    )


class TestDelete:
    async def test_ok(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Test that deletion of a group removes it from both databases."""
        group = await data_layer.groups.create("Test")

        await data_layer.groups.delete(group.id)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.groups.get(group.id)

        document_count, row = await asyncio.gather(
            mongo.groups.count_documents({}), get_row_by_id(pg, SQLGroup, 1)
        )

        assert document_count == 0
        assert row is None

    async def test_not_found(self, data_layer: DataLayer):
        """Test that a ResourceNotFoundError is raised when the group does not exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.groups.delete("foobar")
