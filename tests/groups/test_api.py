import pytest
from virtool.users.utils import Permission


async def test_find(spawn_client, all_permissions, no_permissions, snapshot):
    """
    Test that a ``GET /groups`` return a complete list of groups.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.groups.insert_many(
        [
            {
                "_id": "test",
                "name": "testers",
                "permissions": all_permissions,
            },
            {
                "_id": "limited",
                "permissions": no_permissions,
            },
        ]
    )

    resp = await client.get("/groups")

    assert resp.status == 200

    assert await resp.json() == snapshot


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

    resp = await client.post(
        "/groups",
        data={
            "group_id": "test",
        },
    )

    if error:
        await resp_is.bad_request(resp, "Group already exists")
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "https://virtool.example.com/groups/test"

    assert await resp.json() == {
        "id": "test",
        "name": "test",
        "permissions": no_permissions,
        "users": [],
    }

    assert await client.db.groups.find_one("test") == {
        "_id": "test",
        "permissions": no_permissions,
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, all_permissions, resp_is, fake, snapshot):
    """
    Test that a ``GET /groups/:group_id`` return the correct group.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:

        await client.db.users.insert_many(
            [
                {**(await fake.users.create()), "groups": ["foo"]},
                {**(await fake.users.create()), "groups": []},
            ]
        )

        await client.db.groups.insert_one(
            {
                "_id": "foo",
                "permissions": all_permissions,
            },
        )

    resp = await client.get("/groups/foo")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.parametrize(
    "id_,body,status",
    [
        ("foo", {"name": "Techs"}, 200),
        (
            "foo",
            {"permissions": {"create_sample": True, "create_subtraction": True}},
            200,
        ),
        ("foo", {"name": "Techs", "permissions": {"create_sample": True}}, 200),
        ("dne", {"name": "Techs"}, 404),
    ],
    ids=["name", "permissions", "name_permissions", "not_found"],
)
async def test_update(
    id_, body, status, fake, spawn_client, no_permissions, resp_is, snapshot
):
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.users.insert_many(
        [
            {**(await fake.users.create()), "groups": ["test"]},
            {**(await fake.users.create()), "groups": []},
        ]
    )

    await client.db.groups.insert_many(
        [
            {"_id": "test", "name": "Initial", "permissions": no_permissions},
            {"_id": "foo", "name": "Initial", "permissions": no_permissions},
        ]
    )

    resp = await client.patch(
        f"/groups/{id_}",
        data=body,
    )

    assert resp.status == status
    assert await resp.json() == snapshot(name="json")
    assert await client.db.groups.find({}).to_list(None) == snapshot(name="db_groups")
    assert await client.db.users.find({}).to_list(None) == snapshot(name="db_users")


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
