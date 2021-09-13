import pytest
from aiohttp.test_utils import make_mocked_request
from aiohttp.web import Response
from jwt import encode, decode

from virtool.users.jwt import create_access_token, ACCESS_SECRET, JWT_ALGORITHM, create_refresh_token, REFRESH_SECRET, \
    refresh_tokens
from virtool.users.utils import hash_password


async def handler(request, auth):
    assert request.headers["AUTHORIZATION"] == auth
    return Response(headers={"AUTHORIZATION": auth})


async def test_auth_header():
    """
    Test that jwt in authorization header remains unchanged when sent/returned in a request and response
    """
    jwt = encode({"user": "info"}, "secret", algorithm=JWT_ALGORITHM)
    auth = f"Bearer {jwt}"
    headers = {
        "AUTHORIZATION": auth
    }
    req = make_mocked_request("GET", "/", headers=headers)

    resp = await handler(req, auth)
    assert resp.headers["AUTHORIZATION"] == auth


async def test_create_access_token(spawn_client):
    """
    Test that access token is created and decoded as expected
    """
    client = await spawn_client(authorize=True)

    await client.db.users.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False
    })

    encoded = await create_access_token(client.app["db"], "ip", "foobar")

    document = decode(encoded, ACCESS_SECRET, algorithms=JWT_ALGORITHM)

    assert document.pop("iat")
    assert document.pop("exp")

    assert document == {
        "user": {
            "id": "foobar",
        },
        "ip": "ip",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False
    }


async def test_login_with_jwt(spawn_client):
    """
    Test that access token is created and attached to AUTHORIZATION header as expected during login.
    """
    client = await spawn_client()

    await client.db.users.insert_one({
        "_id": "username",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "password": hash_password("p@ssw0rd123")
    })

    resp = await client.post("/api/account/login_with_jwt", {
        "username": "username",
        "password": "p@ssw0rd123",
    })

    assert resp.status == 201
    encoded = resp.headers["AUTHORIZATION"].split(" ")[1]
    decoded = decode(encoded, ACCESS_SECRET, algorithms=JWT_ALGORITHM)

    decoded.pop("iat")
    decoded.pop("exp")
    decoded.pop("ip")

    assert decoded == {
        'administrator': False,
        'force_reset': False,
        'groups': [],
        'permissions': [],
        'user': {'id': 'username'}}


async def test_create_refresh_token(spawn_client):
    """
    Test that refresh token is created and attached to user document as expected
    """
    client = await spawn_client(authorize=True)

    await client.db.users.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "password": "p@ssw0rd123"
    })

    await create_refresh_token(client.db, "foobar")

    user_document = await client.db.users.find_one("foobar")
    refresh_token = user_document["refresh_token"]

    decoded = decode(refresh_token, REFRESH_SECRET + "p@ssw0rd123", algorithms=JWT_ALGORITHM)
    decoded.pop("exp", "iat")


@pytest.mark.parametrize("password_change", [True, False])
async def test_refresh_tokens(spawn_client, password_change):
    """
    Test that refresh_tokens returns a valid access token if password hasn't been changed
    """
    client = await spawn_client(authorize=True)

    await client.db.users.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "password": "p@ssw0rd123"
    })

    encoded = await create_access_token(client.app["db"], "ip", "foobar")

    await create_refresh_token(client.db, "foobar")

    if password_change:
        await client.db.users.find_one_and_update(
            {"_id": "foobar"},
            {"$set": {"password": "new_password"}}
        )

    new_token = await refresh_tokens(encoded, client.db)

    if password_change:
        assert new_token is None
    else:
        decoded = decode(encoded, ACCESS_SECRET, algorithms=JWT_ALGORITHM)

        decoded.pop("iat")
        decoded.pop("exp")
        decoded.pop("ip")

        assert decoded == {
            'administrator': False,
            'force_reset': False,
            'groups': [],
            'permissions': [],
            'user': {'id': 'foobar'}}
