import pytest
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate


class TestFind:
    async def test_list(
        self, fake2: DataFaker, snapshot: SnapshotAssertion, spawn_client: ClientSpawner
    ):
        """Test that a full list of groups is returned when pagination is not toggled."""

        for _ in range(10):
            await fake2.groups.create()

        # Need a capitalized group name to make sure ordering is case-insensitive.
        await fake2.groups.create(name="Caps")

        client = await spawn_client(authenticated=True)

        resp = await client.get("/groups")

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_paginate(
        self,
        fake2: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that the correct page of groups and the correct search metadata values
        are returned when `page` is `1` or `2`."""
        for _ in range(4):
            await fake2.groups.create()

        await fake2.groups.create(name="Caps")

        for _ in range(10):
            await fake2.groups.create()

        client = await spawn_client(authenticated=True)

        for page in [1, 2]:
            resp = await client.get(f"/groups?paginate=true&page={page}&per_page=10")
            assert resp.status == 200
            assert await resp.json() == snapshot(name=f"page_{page}")


class TestCreate:
    async def test_ok(self, snapshot, spawn_client: ClientSpawner):
        """Test that the request succeeds."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
            base_url="https://virtool.example.com",
        )

        resp = await client.post("/groups", data={"name": "Test"})

        assert resp.status == 201
        assert resp.headers.get("Location") == "https://virtool.example.com/groups/1"
        assert await resp.json() == snapshot(name="json")

    async def test_duplicate(
        self, fake2: DataFaker, snapshot, spawn_client: ClientSpawner
    ):
        """Test that an error is returned when an existing group name is used."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        group = await fake2.groups.create()

        resp = await client.post("/groups", data={"name": group.name})

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("status", [200, 404])
async def test_get(
    status: int,
    fake2: DataFaker,
    snapshot,
    spawn_client: ClientSpawner,
):
    """Test that a ``GET /groups/:group_id`` return the correct group."""
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create(groups=[group])

    resp = await client.get(f"/groups/{group.id if status == 200 else 5}")

    assert resp.status == status
    assert await resp.json() == snapshot


@pytest.mark.apitest
class TestUpdate:
    async def test(
        self, fake2: DataFaker, spawn_client: ClientSpawner, snapshot: SnapshotAssertion
    ):
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

        resp = await client.patch("/groups/5", data={"name": "Real boys"})

        assert resp.status == 404
        assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("status", [204, 404])
async def test_delete(status: int, fake2: DataFaker, spawn_client: ClientSpawner):
    """
    Test that an existing document can be removed at ``DELETE /groups/:group_id``.

    """
    client = await spawn_client(administrator=True, authenticated=True)

    group = await fake2.groups.create(
        permissions=PermissionsUpdate(create_sample=True, remove_file=True)
    )

    await fake2.users.create(groups=[group])

    resp = await client.delete(f"/groups/{5 if status == 404 else group.id}")

    assert resp.status == status
    assert await resp.json() == (
        None
        if status == 204
        else {
            "id": "not_found",
            "message": "Not found",
        }
    )
