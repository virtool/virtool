import pytest
from virtool.users.utils import check_password


async def test_find(snapshot, spawn_client, create_user, static_time):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, administrator=True, permissions=["create_sample"])

    await client.db.users.insert_one(create_user(user_id="foo", handle="bar"))
    await client.db.users.insert_one(create_user(user_id="bar", handle="baz"))

    resp = await client.get("/users")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, snapshot, spawn_client, create_user, no_permissions, resp_is, static_time):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, administrator=True)

    users = [create_user(user_id="foo", handle="bar")]

    if not error:
        users.append(create_user(user_id="bar", handle="baz"))

    await client.db.users.insert_many(users)

    resp = await client.get("/users/bar")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "400_exists", "400_password"])
async def test_create(error, snapshot, spawn_client, create_user, resp_is, static_time, mocker):
    """
    Test that a valid request results in a user document being properly inserted.

    - check response
    - check database
    - check password

    """
    client = await spawn_client(authorize=True, administrator=True)
    mocker.patch("virtool.db.utils.get_new_id", return_value="abc123")

    if error == "400_exists":
        await client.db.users.insert_one({
            "_id": "abc123"
        })

    client.app["settings"].minimum_password_length = 8

    data = {
        "handle": "fred",
        "password": "hello_world",
        "force_reset": False
    }

    if error == "400_password":
        data["password"] = "foo"

    resp = await client.post("/users", data)

    if error == "400_exists":
        await resp_is.bad_request(resp, "User already exists")
        return

    if error == "400_password":
        await resp_is.bad_request(resp, "Password does not meet minimum length requirement (8)")
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "/users/abc123"
    assert await resp.json() == snapshot

    document = await client.db.users.find_one("abc123")
    password = document.pop("password")

    assert document == snapshot
    assert check_password("hello_world", password)


@pytest.mark.parametrize("data", [
    {"password": "hello_world", "force_reset": True, "primary_group": "tech"},
    {"password": "hello_world", "force_reset": True},
    {"force_reset": True, "primary_group": "tech"},
    {"password": "hello_world", "primary_group": "tech"},
    {"password": "hello_world"},
    {"force_reset": True},
    {"primary_group": "tech"}
])
@pytest.mark.parametrize("error", [None, "invalid_input", "user_dne", "group_dne", "not_group_member"])
async def test_edit(data, error, snapshot, spawn_client, resp_is, static_time, create_user, no_permissions):

    client = await spawn_client(authorize=True, administrator=True)

    client.app["settings"].minimum_password_length = 8

    if error != "user_dne":
        await client.db.users.insert_one(create_user(
            user_id="bob",
            handle="fred",
            groups=[] if error == "not_group_member" else ["tech"]
        ))

    # Don't insert the 'tech' group when we are checking for failure when group is missing.
    await client.db.groups.insert_many([
        {
            "_id": "test",
            "permissions": dict(no_permissions, build_index=True)
        },
        {
            "_id": "manager" if error == "group_dne" else "tech",
            "permissions": dict(no_permissions)
        }
    ])

    payload = dict(data)

    if error == "invalid_input":
        payload["force_reset"] = "baz"

    resp = await client.patch("/users/bob", payload)

    if "primary_group" in data:
        if error == "group_dne":
            await resp_is.bad_request(resp, "Primary group does not exist")
            return

        elif error == "not_group_member":
            await resp_is.conflict(resp, "User is not member of group")
            return

    if error == "invalid_input":
        await resp_is.invalid_input(resp, {
            "force_reset": ["must be of boolean type"]
        })
        return

    if error == "user_dne":
        await resp_is.not_found(resp, "User does not exist")
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "400"])
async def test_remove(error, spawn_client, resp_is, create_user):
    """
    Test that a group is removed from the user for a valid request.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await client.db.users.insert_one(create_user(user_id="bob", handle="fred"))

    resp = await client.delete("/users/bob")

    if error:
        await resp_is.not_found(resp)
        return

    await resp_is.no_content(resp)
