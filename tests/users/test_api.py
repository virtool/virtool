import pytest

from virtool_core.models.enums import Permission
from virtool.users.utils import check_password


async def test_find(snapshot, spawn_client, create_user, static_time):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(
        authorize=True, administrator=True, permissions=[Permission.create_sample]
    )

    await client.db.users.insert_one(create_user(user_id="foo", handle="bar"))
    await client.db.users.insert_one(create_user(user_id="bar", handle="baz"))

    resp = await client.get("/users")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error, snapshot, spawn_client, create_user, no_permissions, resp_is, static_time
):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.groups.insert_one(
        {"_id": "technician", "permissions": no_permissions}
    )

    users = [create_user(user_id="foo", handle="bar")]

    if not error:
        users.append(create_user(user_id="bar", groups=["technician"], handle="baz"))

    await client.db.users.insert_many(users)

    resp = await client.get("/users/bar")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "400_exists", "400_password"])
async def test_create(
    error, snapshot, spawn_client, create_user, resp_is, static_time, mocker
):
    """
    Test that a valid request results in a user document being properly inserted.

    - check response
    - check database
    - check password

    """
    client = await spawn_client(authorize=True, administrator=True)
    mocker.patch("virtool.mongo.utils.get_new_id", return_value="abc123")

    if error == "400_exists":
        await client.db.users.insert_one({"_id": "abc123"})

    client.app["settings"].minimum_password_length = 8

    data = {"handle": "fred", "password": "hello_world", "force_reset": False}

    if error == "400_password":
        data["password"] = "foo"

    resp = await client.post("/users", data)

    if error == "400_exists":
        await resp_is.bad_request(resp, "User already exists")
        return

    if error == "400_password":
        await resp_is.bad_request(
            resp, "Password does not meet minimum length requirement (8)"
        )
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "/users/abc123"
    assert await resp.json() == snapshot

    document = await client.db.users.find_one("abc123")
    password = document.pop("password")

    assert document == snapshot
    assert check_password("hello_world", password)


@pytest.mark.parametrize(
    "data,status",
    [
        # These requests should succeed:
        (
            {
                "password": "hello_world",
                "force_reset": True,
                "primary_group": "technicians",
            },
            200,
        ),
        # Succeeds and adds user to 'managers' group.
        ({"groups": ["technicians", "managers"]}, 200),
        # Fails because the password is too short.
        ({"password": "cat"}, 400),
        # Fails because the group does not exist.
        ({"primary_group": "directors"}, 400),
        # Fails because the user is not a member of the group.
        ({"primary_group": "managers"}, 400),
    ],
    ids=[
        "good",
        "good_add_group",
        "short_password",
        "nonexistent_primary_group",
        "nonmember_primary_group",
    ],
)
async def test_edit(
    data,
    status,
    snapshot,
    spawn_client,
    resp_is,
    static_time,
    create_user,
    no_permissions,
):
    client = await spawn_client(authorize=True, administrator=True)

    client.app["settings"].minimum_password_length = 8

    await client.db.users.insert_one(
        create_user(
            user_id="bob",
            handle="fred",
            groups=["technicians"],
        )
    )

    await client.db.groups.insert_many(
        [
            {
                "_id": "technicians",
                "permissions": {**no_permissions, "build_index": True},
            },
            {
                "_id": "managers",
                "permissions": {
                    **no_permissions,
                    "create_sample": True,
                    "create_ref": True,
                },
            },
        ]
    )

    resp = await client.patch("/users/bob", data)

    assert resp.status == status
    assert (resp.status, await resp.json()) == snapshot


async def test_edit_404(snapshot, spawn_client):
    """
    Ensure 404 is returned when user does not exist.
    """
    client = await spawn_client(authorize=True, administrator=True)
    resp = await client.patch("/users/bob", {"groups": ["technicians"]})
    assert (resp.status, await resp.json()) == snapshot
