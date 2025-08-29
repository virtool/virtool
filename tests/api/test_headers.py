from aiohttp.web_request import Request
from aiohttp.web_response import Response
from aiohttp.web_routedef import RouteTableDef

_routes = RouteTableDef()


@_routes.get("/foo")
async def public_test_route(req: Request):
    return Response(
        status=200, headers={"Location": "/foo", "Content-Location": "/bar"}
    )


async def test_on_prepare_location_location(spawn_client):
    client = await spawn_client(
        addon_route_table=_routes,
        authenticated=True,
        base_url="foobar",
    )

    resp = await client.get("/foo")

    assert resp.headers["Location"] == "foobar/foo"
    assert resp.headers["Content-Location"] == "foobar/bar"
