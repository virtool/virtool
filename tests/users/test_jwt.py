from aiohttp.web import Response
from aiohttp.test_utils import make_mocked_request
from jwt import encode


async def handler(request, auth):
    assert request.headers["AUTHORIZATION"] == auth
    return Response(headers={"AUTHORIZATION": auth})


async def test_auth_header():
    jwt = encode({"user": "info"}, "secret", algorithm="HS256")
    auth = f"Bearer {jwt}"
    headers = {
        "AUTHORIZATION": auth
    }
    req = make_mocked_request("GET", "/", headers=headers)

    resp = await handler(req, auth)
    assert resp.headers["AUTHORIZATION"] == auth
