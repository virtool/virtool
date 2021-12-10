from aiohttp.web_request import Request
from aiohttp.web_response import Response
from aiohttp.web_routedef import RouteTableDef

test_routes = RouteTableDef()


@test_routes.get("/foo")
def public_test_route(request: Request):
    headers = {"Location": "/foo"}
    return Response(status=200, headers=headers)


async def test_on_prepare_location_location(spawn_client):
    client = await spawn_client(base_url="foobar", authorize=True, addon_route_table=test_routes)

    resp = await client.get("/foo")

    assert resp.headers["Location"] == "foobar/foo"
