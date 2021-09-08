from aiohttp.web import Response
from aiohttp.test_utils import make_mocked_request
from jwt import encode, decode

from virtool.users.jwt import create_access_token, fetch_access_token_secret


async def handler(request, auth):
    assert request.headers["AUTHORIZATION"] == auth
    return Response(headers={"AUTHORIZATION": auth})


async def test_auth_header():
    """
    Test that jwt in authorization header remains unchanged when sent/return in a request and response
    """
    jwt = encode({"user": "info"}, "secret", algorithm="HS256")
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

    encoded = await create_access_token(client.app["db"], "ip", "foobar", False)

    secret = await fetch_access_token_secret()

    document = decode(encoded, secret, algorithms="HS256")

    # find a way to check these are valid times
    assert document.pop("iat")
    assert document.pop("exp")

    assert document == {
        "user": {
            "id": "foobar"
        },
        "ip": "ip",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False
    }
