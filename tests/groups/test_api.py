import pytest

from virtool.groups.oas import UpdatePermissionsRequest


@pytest.fixture
async def setup_update_group(spawn_client, fake2):
    client = await spawn_client(authorize=True, administrator=True)

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create()
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])

    return client, group


async def test_find(fake2, spawn_client, all_permissions, no_permissions, snapshot):
    """
    Test that a ``GET /groups`` return a complete list of groups.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await fake2.groups.create()
    await fake2.groups.create()

    resp = await client.get("/groups")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("status", [201, 400])
async def test_create(status, fake2, mongo, spawn_client, snapshot):
    """
    Test that a group can be added to the database at ``POST /groups/:group_id``.

    """
    await mongo.groups.create_index("name", unique=True, sparse=True)

    client = await spawn_client(
        authorize=True, administrator=True, base_url="https://virtool.example.com"
    )

    group = await fake2.groups.create()

    resp = await client.post(
        "/groups",
        data={
            "group_id": group.name if status == 400 else "test",
        },
    )

    assert resp.status == status
    assert resp.headers.get("Location") == snapshot(name="location")
    assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("status", [200, 404])
async def test_get(status, fake2, spawn_client, snapshot):
    """
    Test that a ``GET /groups/:group_id`` return the correct group.

    """
    client = await spawn_client(authorize=True, administrator=True)

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

        # Ensure that members users are updated with new permissions.
        assert await client.db.users.find({}, ["handle", "permissions"]).to_list(
            None
        ) == snapshot(name="users")

    async def test_not_found(self, setup_update_group, snapshot):
        client, _ = setup_update_group

        resp = await client.patch(
            f"/groups/ghosts",
            data={"name": "Real boys"},
        )

        assert resp.status == 404
        assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("status", [204, 404])
async def test_remove(status, fake2, snapshot, spawn_client):
    """
    Test that an existing document can be removed at ``DELETE /groups/:group_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    group_1 = await fake2.groups.create(
        permissions=UpdatePermissionsRequest(create_sample=True, remove_file=True)
    )

    group_2 = await fake2.groups.create(
        permissions=UpdatePermissionsRequest(upload_file=True)
    )

    await fake2.users.create(groups=[group_1, group_2])
    await fake2.users.create(groups=[group_1])
    await fake2.users.create(groups=[group_2])

    resp = await client.delete(f"/groups/{'ghosts' if status == 404 else group_1.id}")

    assert resp.status == status
    assert await resp.json() == snapshot(name="json")

    if status == 204:
        assert await client.db.groups.count_documents({"_id": group_1.id}) == 0

    assert await client.db.users.find({}, ["name", "permissions"]).to_list(
        None
    ) == snapshot(name="users")
