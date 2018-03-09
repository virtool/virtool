import datetime
import pytest
from operator import itemgetter

from virtool.user import check_password
from virtool.user_permissions import PERMISSIONS


async def test_find(spawn_client, create_user):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, permissions=["manage_users"])

    user_ids = ["bob", "fred", "john"]

    await client.db.users.insert_many([create_user(user_id) for user_id in user_ids])

    resp = await client.get("/api/users")

    assert resp.status == 200

    base_dict = {
        "force_reset": False,
        "groups": [],
        "last_password_change": "2015-10-06T20:00:00Z",
        "permissions": {p: False for p in PERMISSIONS},
        "primary_group": "technician"
    }

    expected = [dict(base_dict, id=user_id) for user_id in user_ids + ["test"]]

    expected[3]["permissions"] = dict(base_dict["permissions"], manage_users=True)

    assert sorted(await resp.json(), key=itemgetter("id")) == sorted(expected, key=itemgetter("id"))


class TestGet:

    async def test_exists(self, spawn_client, create_user):
        """
        Test that a ``GET /api/users`` returns a list of users.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        bob, fred = [create_user(user_id) for user_id in ("bob", "fred")]

        await client.db.users.insert_many([bob, fred])

        resp = await client.get("/api/users/fred")

        assert resp.status == 200

        assert await resp.json() == {
            "id": "fred",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": bob["permissions"],
            "primary_group": "technician"
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a ``GET /api/users/:user_id`` for a non-existent ``user_id`` results in a ``404`` response.
        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.get("/api/users/fred")

        assert await resp_is.not_found(resp)


class TestCreate:

    async def test(self, spawn_client, create_user, static_time):
        """
        Test that a valid request results in a user document being properly inserted.

        - check response
        - check database
        - check password

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        client.app["settings"]["minimum_password_length"] = 8

        data = {
            "user_id": "bob",
            "password": "hello_world",
            "force_reset": False
        }

        resp = await client.post("/api/users", data)

        assert resp.status == 201

        assert resp.headers["Location"] == "/api/users/bob"

        expected = {
            "id": "bob",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2015-10-06T20:00:00Z",
            "identicon": "81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9",
            "permissions": create_user()["permissions"],
            "primary_group": ""
        }

        assert await resp.json() == expected

        expected.update({
            "_id": expected.pop("id"),
            "last_password_change": static_time
        })

        assert await client.db.users.find_one("bob", list(expected.keys())) == expected

        document = await client.db.users.find_one("bob", ["password"])

        assert check_password("hello_world", document["password"])

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that invalid and missing input data result in a ``422`` response with detailed error data.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        client.app["settings"]["minimum_password_length"] = 8

        data = {
            "username": "bob",
            "password": 1234,
            "force_reset": False
        }

        resp = await client.post("/api/users", data)

        assert resp.status == 422

        assert await resp_is.invalid_input(resp, {
            "username": ["unknown field"],
            "password": ["must be of string type"],
            "user_id": ["required field"]
        })

    async def test_user_exists(self, spawn_client, resp_is):
        """
        Test that an input ``user_id`` that already exists results in a ``400`` response with informative error message.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        client.app["settings"]["minimum_password_length"] = 8

        data = {
            "user_id": "test",
            "password": "hello_world",
            "force_reset": False
        }

        resp = await client.post("/api/users", data)

        assert await resp_is.conflict(resp, "User already exists")


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

    client = await spawn_client(authorize=True, permissions=["manage_users"])

    client.app["settings"]["minimum_password_length"] = 8

    bob = None

    if error != "user_dne":
        groups = [] if error == "not_group_member" else ["tech"]
        bob = dict(create_user("bob", groups=groups))
        await client.db.users.insert_one(bob)

    groups_to_insert = [{
        "_id": "test",
        "permissions": dict(no_permissions, rebuild_index=True)
    }]

    if error != "group_dne":
        groups_to_insert.append({
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        })

    await client.db.groups.insert_many(groups_to_insert)

    payload = dict(data)

    if error == "invalid_input":
        payload["foobar"] = "baz"

    resp = await client.patch("/api/users/bob", payload)

    if "primary_group" in data:
        if error == "group_dne":
            assert await resp_is.not_found(resp, "Group not found")

        elif error == "not_group_member":
            assert await resp_is.bad_request(resp, "User is not member of group: tech")

    elif error == "invalid_input":
        assert await resp_is.invalid_input(resp, {
            "foobar": ["unknown field"]
        })

    elif error == "user_dne":
        assert await resp_is.not_found(resp)

    else:
        expected = dict(bob, last_password_change=static_time)
        expected.update(payload)

        expected.pop("password")

        if "password" in data or data.get("force_reset", False):
            expected["invalidate_sessions"] = True

        assert await client.db.users.find_one({"_id": "bob"}, {"password": False}) == expected

        expected.update({
            "id": expected["_id"],
            "last_password_change": "2015-10-06T20:00:00Z"
        })

        for key in ["_id", "api_keys", "invalidate_sessions", "settings"]:
            expected.pop(key)

        assert resp.status == 200

        assert await resp.json() == expected


@pytest.mark.parametrize("error", [None, "invalid_input", "user_dne", "group_dne"])
async def test_add_group(error, spawn_client, resp_is, create_user, no_permissions):
    """
    Test that a valid request results in the addition of a group to a user document.

    """
    client = await spawn_client(authorize=True, permissions=["manage_users"])

    groups_to_insert = [{
        "_id": "test",
        "permissions": dict(no_permissions, rebuild_index=True)
    }]

    if error != "group_dne":
        groups_to_insert.append({
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        })

    await client.db.groups.insert_many(groups_to_insert)

    if error != "user_dne":
        bob = create_user("bob")
        await client.db.users.insert(bob)

    if error == "invalid_input":
        data = {
            "group": "tech"
        }
    else:
        data = {
            "group_id": "tech"
        }

    resp = await client.post("/api/users/bob/groups", data)

    if error is None:
        assert resp.status == 200
        assert await resp.json() == ["tech"]

    elif error == "user_dne":
        assert await resp_is.not_found(resp)

    elif error == "group_dne":
        assert await resp_is.not_found(resp, "Group not found")

    else:
        assert await resp_is.invalid_input(resp, {
            "group": ["unknown field"],
            "group_id": ["required field"]
        })


@pytest.mark.parametrize("user_exists", [True, False])
async def test_remove_group(user_exists, spawn_client, create_user, resp_is, no_permissions):
    """
    Test that a valid request can result in removal of a group from a user and recalculation of the user"s
    permissions.

    """
    client = await spawn_client(authorize=True, permissions=["manage_users"])

    await client.db.groups.insert_many([
        {
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        },
        {
            "_id": "test",
            "permissions": dict(no_permissions, rebuild_index=True)
        }
    ])

    bob = create_user(
        "bob",
        groups=["tech", "test"],
        permissions=["modify_virus", "rebuild_index"]
    )

    if user_exists:
        await client.db.users.insert_one(bob)

        await client.db.users.update_one({"_id": "bob"}, {
            "$set": {
                "primary_group": "tech"
            }
        })

        assert await client.db.users.find_one("bob", ["_id", "groups", "permissions"]) == {
            "_id": "bob",
            "groups": ["tech", "test"],
            "permissions": dict(no_permissions, modify_virus=True, rebuild_index=True)
        }

    resp = await client.delete("/api/users/bob/groups/tech")

    if user_exists:
        assert resp.status == 200
        assert await resp.json() == ["test"]
    else:
        assert await resp_is.not_found(resp)


@pytest.mark.parametrize("exists", [True, False])
async def test_remove(exists, spawn_client, resp_is, create_user):
    """
    Test that a group is removed from the user for a valid request.

    """
    client = await spawn_client(authorize=True, permissions=["manage_users"])

    if exists:
        await client.db.users.insert_one(create_user("bob"))

    resp = await client.delete("/api/users/bob")

    if exists:
        assert resp.status == 204
    else:
        assert await resp_is.not_found(resp)
