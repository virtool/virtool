import pytest
from aiohttp.test_utils import make_mocked_coro


async def test_find(spawn_client, all_permissions, no_permissions):
    """
    Test that a ``GET /api/groups`` return a complete list of groups.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.groups.insert_many([
        {
            "_id": "test",
            "permissions": all_permissions
        },
        {
            "_id": "limited",
            "permissions": no_permissions
        }
    ])

    resp = await client.get("/api/groups")

    assert resp.status == 200

    assert await resp.json() == [
        {
            "id": "test",
            "permissions": all_permissions
        },
        {
            "id": "limited",
            "permissions": no_permissions
        }
    ]


@pytest.mark.parametrize("error", [None, "400_exists"])
async def test_create(error, spawn_client, all_permissions, no_permissions, resp_is):
    """
    Test that a group can be added to the database at ``POST /api/groups/:group_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if error:
        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": all_permissions
        })

    resp = await client.post("/api/groups", data={
        "group_id": "test"
    })

    if error:
        await resp_is.bad_request(resp, "Group already exists")
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "/api/groups/test"

    assert await resp.json() == {
        "id": "test",
        "permissions": no_permissions
    }

    assert await client.db.groups.find_one("test") == {
        "_id": "test",
        "permissions": no_permissions
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, all_permissions, resp_is):
    """
    Test that a ``GET /api/groups/:group_id`` return the correct group.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await client.db.groups.insert_one({
            "_id": "foo",
            "permissions": all_permissions
        })

    resp = await client.get("/api/groups/foo")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        "id": "foo",
        "permissions": all_permissions
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_update_permissions(error, spawn_client, no_permissions, resp_is):
    """
    Test that a valid request results in permission changes.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": no_permissions
        })

    resp = await client.patch("/api/groups/test", data={
        "permissions": {
            "create_sample": True
        }
    })

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    no_permissions["create_sample"] = True

    assert await resp.json() == {
        "id": "test",
        "permissions": no_permissions
    }

    assert await client.db.groups.find_one("test") == {
        "_id": "test",
        "permissions": no_permissions
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_remove(error, mocker, spawn_client, no_permissions, resp_is):
    """
    Test that an existing document can be removed at ``DELETE /api/groups/:group_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": no_permissions
        })

    m_update_member_users = mocker.patch("virtool.groups.db.update_member_users", make_mocked_coro(None))

    resp = await client.delete("/api/groups/test")

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    await resp_is.no_content(resp)

    assert not await client.db.groups.count_documents({"_id": "test"})

    m_update_member_users.assert_called_with(
        client.db,
        "test",
        remove=True
    )
