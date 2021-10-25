import pytest

from virtool.users.utils import check_password


async def test_find(spawn_client, create_user, static_time):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, administrator=True, permissions=["create_sample"])

    await client.db.users.insert_one(create_user(user_id="foo", handle="bar"))
    await client.db.users.insert_one(create_user(user_id="bar", handle="baz"))

    resp = await client.get("/api/users")

    assert resp.status == 200

    assert await resp.json() == {
        "documents": [
            {
                "administrator": False,
                "force_reset": False,
                "groups": [],
                "id": "bar",
                "handle": "baz",
                "identicon": "identicon",
                "last_password_change": static_time.iso,
                "permissions": {
                    "cancel_job": False,
                    "create_ref": False,
                    "create_sample": False,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": False,
                    "upload_file": False},
                "primary_group": "technician"},
            {
                "administrator": False,
                "force_reset": False,
                "groups": [],
                "id": "foo",
                "handle": "bar",
                "identicon": "identicon",
                "last_password_change": static_time.iso,
                "permissions": {
                    "cancel_job": False,
                    "create_ref": False,
                    "create_sample": False,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": False,
                    "upload_file": False
                },
                "primary_group": "technician"
            },
            {
                "administrator": True,
                "force_reset": False,
                "groups": [],
                "id": "test",
                "handle": "bob",
                "identicon": "identicon",
                "last_password_change": static_time.iso,
                "permissions": {
                    "cancel_job": False,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": False,
                    "upload_file": False
                },
                "primary_group": "technician"
            }
        ],
        "found_count": 3,
        "page": 1,
        "page_count": 1,
        "per_page": 25,
        "total_count": 3
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, create_user, no_permissions, resp_is, static_time):
    """
    Test that a ``GET /api/users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, administrator=True)

    users = [create_user(user_id="foo", handle="bar")]

    if not error:
        users.append(create_user(user_id="bar", handle="baz"))

    await client.db.users.insert_many(users)

    resp = await client.get("/api/users/bar")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        "id": "bar",
        "handle": "baz",
        "administrator": False,
        "force_reset": False,
        "groups": [],
        "identicon": "identicon",
        "last_password_change": static_time.iso,
        "permissions": no_permissions,
        "primary_group": "technician"
    }


@pytest.mark.parametrize("error", [None, "400_exists", "400_password"])
async def test_create(error, spawn_client, create_user, resp_is, static_time, mocker):
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

    client.app["settings"]["minimum_password_length"] = 8

    data = {
        "handle": "fred",
        "password": "hello_world",
        "force_reset": False
    }

    if error == "400_password":
        data["password"] = "foo"

    resp = await client.post("/api/users", data)

    if error == "400_exists":
        await resp_is.bad_request(resp, "User already exists")
        return

    if error == "400_password":
        await resp_is.bad_request(resp, "Password does not meet minimum length requirement (8)")
        return

    assert resp.status == 201

    assert resp.headers["Location"] == "/api/users/abc123"

    expected = {
        "id": "abc123",
        "handle": "fred",
        "administrator": False,
        "force_reset": False,
        "groups": [],
        "last_password_change": static_time.iso,
        "identicon": "d0cfc2e5319b82cdc71a33873e826c93d7ee11363f8ac91c4fa3a2cfcd2286e5",
        "permissions": create_user()["permissions"],
        "primary_group": ""
    }

    assert await resp.json() == expected

    expected.update({
        "_id": expected.pop("id"),
        "last_password_change": static_time.datetime
    })

    assert await client.db.users.find_one("abc123", list(expected.keys())) == expected

    document = await client.db.users.find_one("abc123", ["password"])

    assert check_password("hello_world", document["password"])


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
async def test_edit(data, error, spawn_client, resp_is, static_time, create_user, no_permissions):

    client = await spawn_client(authorize=True, administrator=True)

    client.app["settings"]["minimum_password_length"] = 8

    bob = None

    if error != "user_dne":
        groups = [] if error == "not_group_member" else ["tech"]
        bob = dict(create_user(user_id="bob", handle="fred", groups=groups))
        await client.db.users.insert_one(bob)

    groups_to_insert = [{
        "_id": "test",
        "permissions": dict(no_permissions, build_index=True)
    }]

    if error != "group_dne":
        groups_to_insert.append({
            "_id": "tech",
            "permissions": dict(no_permissions)
        })

    await client.db.groups.insert_many(groups_to_insert)

    payload = dict(data)

    if error == "invalid_input":
        payload["force_reset"] = "baz"

    resp = await client.patch("/api/users/bob", payload)

    if "primary_group" in data:
        if error == "group_dne":
            await resp_is.bad_request(resp, "Primary group does not exist")

        elif error == "not_group_member":
            await resp_is.conflict(resp, "User is not member of group")

    elif error == "invalid_input":
        await resp_is.invalid_input(resp, {
            "force_reset": ["must be of boolean type"]
        })

    elif error == "user_dne":
        await resp_is.not_found(resp, "User does not exist")

    else:
        expected = dict(bob, last_password_change=static_time.datetime)
        expected.update(payload)

        expected.pop("password")

        if "password" in data or data.get("force_reset", False):
            expected["invalidate_sessions"] = True

        assert await client.db.users.find_one({"_id": "bob"}, {"password": False}) == expected

        expected.update({
            "id": expected["_id"],
            "last_password_change": static_time.iso
        })

        for key in ["_id", "api_keys", "invalidate_sessions", "settings"]:
            expected.pop(key)

        assert resp.status == 200

        assert await resp.json() == expected


@pytest.mark.parametrize("error", [None, "400"])
async def test_remove(error, spawn_client, resp_is, create_user):
    """
    Test that a group is removed from the user for a valid request.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await client.db.users.insert_one(create_user(user_id="bob", handle="fred"))

    resp = await client.delete("/api/users/bob")

    if error:
        await resp_is.not_found(resp)
        return

    await resp_is.no_content(resp)
