import pytest
from aiohttp.test_utils import make_mocked_coro
from virtool.users.utils import Permission


async def test_find(spawn_client, all_permissions, no_permissions):
    """
    Test that a ``GET /groups`` return a complete list of groups.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.groups.insert_many(
        [
            {"_id": "test", "name": "testers", "permissions": all_permissions},
            {"_id": "limited", "permissions": no_permissions},
        ]
    )

    resp = await client.get("/groups")

    assert resp.status == 200

    assert await resp.json() == [
        {"id": "test", "name": "testers", "permissions": all_permissions},
        {"id": "limited", "name": "limited", "permissions": no_permissions},
    ]


@pytest.mark.parametrize("error", [None, "400_exists"])
async def test_create(error, spawn_client, all_permissions, no_permissions, resp_is):
    """
    Test that a group can be added to the database at ``POST /groups/:group_id``.

    """
    client = await spawn_client(
        authorize=True, administrator=True, base_url="https://virtool.example.com"
    )

    if error:
        await client.db.groups.insert_one(
            {"_id": "test", "permissions": all_permissions}
        )

    resp = await client.post("/groups", data={"group_id": "test"})

    if error:
        await resp_is.bad_request(resp, "Group already exists")
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "https://virtool.example.com/groups/test"

    assert await resp.json() == {
        "id": "test",
        "name": "test",
        "permissions": no_permissions,
    }

    assert await client.db.groups.find_one("test") == {
        "_id": "test",
        "permissions": no_permissions,
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, all_permissions, resp_is):
    """
    Test that a ``GET /groups/:group_id`` return the correct group.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await client.db.groups.insert_one(
            {"_id": "foo", "permissions": all_permissions},
        )

    resp = await client.get("/groups/foo")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        "id": "foo",
        "name": "foo",
        "permissions": all_permissions,
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_update_permissions(
    error, fake, spawn_client, no_permissions, resp_is, snapshot
):
    """
    Test that a valid request results in permission changes.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.users.insert_many(
        [
            {**(await fake.users.create()), "groups": ["test"]},
            {**(await fake.users.create()), "groups": []},
        ]
    )

    if not error:
        await client.db.groups.insert_one(
            {"_id": "test", "permissions": no_permissions}
        )

    resp = await client.patch(
        "/groups/test", data={"permissions": {Permission.create_sample.value: True}}
    )

    if error:
        await resp_is.not_found(resp)
    else:
        assert resp.status == 200
        assert await resp.json() == snapshot(name="json")
        assert await client.db.groups.find_one("test") == snapshot(name="db")

    assert await client.db.users.find().to_list(None) == snapshot(name="users")


@pytest.mark.parametrize("error", [None, "404"])
async def test_remove(error, fake, snapshot, spawn_client, no_permissions, resp_is):
    """
    Test that an existing document can be removed at ``DELETE /groups/:group_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.users.insert_many(
        [
            {
                **(await fake.users.create()),
                "groups": ["test"],
                "permissions": {**no_permissions, Permission.create_sample.value: True},
            },
            {**(await fake.users.create()), "groups": []},
        ]
    )

    if not error:
        await client.db.groups.insert_one(
            {
                "_id": "test",
                "permissions": {**no_permissions, Permission.create_sample.value: True},
            }
        )

    resp = await client.delete("/groups/test")

    if error == "404":
        await resp_is.not_found(resp)
    else:
        await resp_is.no_content(resp)
        assert await client.db.groups.count_documents({"_id": "test"}) == 0

    assert await client.db.users.find({}, ["permissions"]).to_list(None) == snapshot(
        name="users"
    )
