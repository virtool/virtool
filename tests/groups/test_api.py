import asyncio

import pytest

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.groups.oas import UpdatePermissionsRequest
from virtool.mongo.core import Mongo


@pytest.fixture
async def setup_update_group(spawn_client: ClientSpawner, fake2: DataFaker):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create()
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])

    return client, group


async def test_find(fake2: DataFaker, spawn_client: ClientSpawner, snapshot):
    """
    Test that a ``GET /groups`` return a complete list of groups.

    """
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    await fake2.groups.create()
    await fake2.groups.create()

    resp = await client.get("/groups")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("status", [201, 400])
async def test_create(
    status: int,
    fake2: DataFaker,
    mongo: Mongo,
    snapshot,
    spawn_client: ClientSpawner,
):
    """
    Test that a group can be added to the database at ``POST /groups/:group_id``.

    """
    await mongo.groups.create_index("name", unique=True, sparse=True)

    client = await spawn_client(
        administrator=True, authenticated=True, base_url="https://virtool.example.com"
    )

    group = await fake2.groups.create()

    resp = await client.post(
        "/groups", data={"group_id": group.name if status == 400 else "Test"}
    )

    assert resp.status == status
    assert resp.headers.get("Location") == snapshot(name="location")
    assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("status", [200, 404])
async def test_get(
    status: int,
    fake2: DataFaker,
    snapshot,
    spawn_client: ClientSpawner,
):
    """
    Test that a ``GET /groups/:group_id`` return the correct group.

    """
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create(groups=[group])

    resp = await client.get(f"/groups/{group.id if status == 200 else 'foo'}")

    assert resp.status == status
    assert await resp.json() == snapshot


@pytest.mark.apitest
class TestUpdate:
    async def test(self, setup_update_group, snapshot):
        client, group = setup_update_group

        resp = await client.patch(
            f"/groups/{group.id}",
            data={
                "name": "Technicians",
                "permissions": {"create_sample": True, "upload_file": True},
            },
        )

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_not_found(self, snapshot, spawn_client: ClientSpawner):
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        resp = await client.patch("/groups/ghosts", data={"name": "Real boys"})

        assert resp.status == 404
        assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("status", [204, 404])
async def test_remove(
    status: int, fake2: DataFaker, snapshot, spawn_client: ClientSpawner
):
    """
    Test that an existing document can be removed at ``DELETE /groups/:group_id``.

    """
    client = await spawn_client(administrator=True, authenticated=True)

    group = await fake2.groups.create(
        permissions=UpdatePermissionsRequest(create_sample=True, remove_file=True)
    )

    await fake2.users.create(groups=[group])

    resp = await client.delete(f"/groups/{'ghosts' if status == 404 else group.id}")

    assert resp.status == status
    assert await resp.json() == snapshot(name="json")
