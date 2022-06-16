import pytest
from aiohttp.web_response import json_response
from aiohttp.web_routedef import RouteTableDef
from aiohttp_pydantic import PydanticView

from virtool.http.privileges import admin, permissions, public
from virtool.users.utils import Permission


@pytest.fixture
def privilege_routes():
    routes = RouteTableDef()

    @routes.view("/foo")
    class TestDecorators(PydanticView):
        async def get(self):
            return json_response({"test_get": "OK"}, status=200)

        @admin
        async def post(self):
            return json_response({"test_post": "OK"}, status=201)

        @permissions(Permission.modify_subtraction.value)
        async def patch(self):
            return json_response({"test_patch": "OK"}, status=200)

        @public
        async def put(self):
            return json_response({"test_put": "OK"}, status=201)

    return routes


@pytest.mark.parametrize("is_administrator", [True, False])
async def test_get_no_privileges(is_administrator, privilege_routes, spawn_client):
    if is_administrator:
        client = await spawn_client(
            authorize=True, administrator=True, addon_route_table=privilege_routes
        )
    else:
        client = await spawn_client(
            authorize=True, administrator=False, addon_route_table=privilege_routes
        )

    resp = await client.get("/foo")

    assert resp.status == 200
    assert await resp.json() == {"test_get": "OK"}


@pytest.mark.parametrize("is_administrator", [True, False])
async def test_post_admin_privileges(is_administrator, privilege_routes, spawn_client):
    if is_administrator:
        client = await spawn_client(
            authorize=True, administrator=True, addon_route_table=privilege_routes
        )
    else:
        client = await spawn_client(
            authorize=True, administrator=False, addon_route_table=privilege_routes
        )

    resp = await client.post("/foo")

    if is_administrator:
        assert resp.status == 201
        assert await resp.json() == {"test_post": "OK"}

    else:
        assert resp.status == 403
        assert await resp.json() == {
            "id": "not_permitted",
            "message": "Requires administrative privilege",
        }


@pytest.mark.parametrize("has_permission", [True, False])
async def test_patch_permission_privileges(
    has_permission, privilege_routes, spawn_client
):
    if has_permission:
        client = await spawn_client(
            authorize=True,
            permissions=Permission.modify_subtraction.value,
            addon_route_table=privilege_routes,
        )
    else:
        client = await spawn_client(authorize=True, addon_route_table=privilege_routes)

    resp = await client.patch("/foo", data="")

    if has_permission:
        assert resp.status == 200
        assert await resp.json() == {"test_patch": "OK"}

    else:
        assert resp.status == 403
        assert await resp.json() == {"id": "not_permitted", "message": "Not permitted"}


@pytest.mark.parametrize("is_public", [True, False])
async def test_put_public_privileges(is_public, privilege_routes, spawn_client):
    if is_public:
        client = await spawn_client(
            authorize=False, administrator=False, addon_route_table=privilege_routes
        )
    else:
        client = await spawn_client(
            authorize=True, administrator=True, addon_route_table=privilege_routes
        )

    resp = await client.put("/foo", data="")

    assert resp.status == 201
    assert await resp.json() == {"test_put": "OK"}
