from aiohttp.test_utils import make_mocked_request
from aiohttp.web import Response
from jwt import encode, decode

from virtool.users.jwt import create_access_token, ACCESS_SECRET, JWT_ALGORITHM
from virtool.users.utils import hash_password


async def handler(request, auth):
    assert request.headers["AUTHORIZATION"] == auth
    return Response(headers={"AUTHORIZATION": auth})


async def test_auth_header():
    """
    Test that jwt in authorization header remains unchanged when sent/return in a request and response
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

    secret = ACCESS_SECRET

    document = decode(encoded, secret, algorithms=JWT_ALGORITHM)

    # find a way to check these are valid times
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
