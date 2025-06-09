"""Tests for Virtool's route policies.

These are essential to security and are exhaustively tested and don't use snapshots.
Do not use snapshots for these test.



"""

import pytest
from aiohttp.web_exceptions import HTTPNoContent
from aiohttp.web_response import json_response
from aiohttp_pydantic import PydanticView

from tests.fixtures.client import ClientSpawner
from virtool.api.policy import (
    AdministratorRoutePolicy,
    DefaultRoutePolicy,
    PermissionRoutePolicy,
    PublicRoutePolicy,
    policy,
)
from virtool.api.routes import Routes
from virtool.authorization.permissions import LegacyPermission
from virtool.errors import PolicyError
from virtool.models.enums import Permission
from virtool.models.roles import AdministratorRole


@pytest.fixture()
def privilege_routes():
    def func(route_policy):
        routes = Routes()

        # View-less routes with a policy.
        @routes.get("/func")
        @policy(route_policy)
        async def get(_):
            """An example public route."""
            return json_response({"test_get_func": True}, status=200)

        @routes.post("/func")
        @policy(route_policy)
        async def post(req):
            data = await req.json()
            return json_response({"test_post_func": True, **data}, status=201)

        @routes.patch("/func")
        @policy(route_policy)
        async def patch(req):
            data = await req.json()
            return json_response({"test_patch_func": True, **data}, status=200)

        @routes.put("/func")
        @policy(route_policy)
        async def put(req):
            data = await req.json()
            return json_response({"test_patch_func": True, **data}, status=200)

        @routes.delete("/func")
        @policy(route_policy)
        async def delete(_):
            raise HTTPNoContent

        # View-less routes with no policy.
        @routes.get("/no_policy_func")
        async def get_np(_):
            """An example public route."""
            return json_response({"test_get_func": True}, status=200)

        @routes.post("/no_policy_func")
        async def post_np(req):
            data = await req.json()
            return json_response({"test_post": True, **data}, status=201)

        @routes.patch("/no_policy_func")
        async def patch_np(req):
            data = await req.json()
            return json_response({"test_patch": True, **data}, status=200)

        @routes.put("/no_policy_func")
        async def put_np(req):
            data = await req.json()
            return json_response({"test_patch": True, **data}, status=200)

        @routes.delete("/no_policy_func")
        async def delete_np(_):
            raise HTTPNoContent

        # Views with policies defined.
        @routes.view("/view")
        class PolicyDecorators(PydanticView):
            @policy(route_policy)
            async def get(self):
                """An example public route."""
                return json_response({"test_get": "OK"}, status=200)

            @policy(route_policy)
            async def post(self):
                data = await self.request.json()
                return json_response({"test_post": True, **data}, status=201)

            @policy(route_policy)
            async def patch(self):
                data = await self.request.json()
                return json_response({"test_patch": True, **data}, status=200)

            @policy(route_policy)
            async def put(self):
                data = await self.request.json()
                return json_response({"test_put": True, **data}, status=201)

            @policy(route_policy)
            async def delete(self):
                raise HTTPNoContent

        # Views with no policies defined.
        @routes.view("/no_policy_view")
        class NoPolicyView(PydanticView):
            async def get(self):
                """An example public route."""
                return json_response({"test_get": True}, status=200)

            async def post(self):
                data = await self.request.json()
                return json_response({"test_post": True, **data}, status=201)

            async def patch(self):
                data = await self.request.json()
                return json_response({"test_patch": True, **data}, status=200)

            async def put(self):
                data = await self.request.json()
                return json_response({"test_put": True, **data}, status=201)

            async def delete(self):
                raise HTTPNoContent

        return routes

    return func


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("authenticated", [True, False])
async def test_public(
    administrator: bool,
    authenticated: bool,
    privilege_routes,
    spawn_client: ClientSpawner,
):
    """Test that all clients can access public endpoints."""
    client = await spawn_client(
        addon_route_table=privilege_routes(PublicRoutePolicy),
        administrator=administrator,
        authenticated=authenticated,
    )

    for url in ("/view", "/func"):
        for method in ["get", "post", "patch", "put", "delete"]:
            if method in ("get", "delete"):
                resp = await getattr(client, method)(url)
            else:
                resp = await getattr(client, method)(url, {"is_public_test": True})

            assert resp.status in (200, 201, 204)


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("authenticated", [True, False])
async def test_default(
    administrator: bool,
    authenticated: bool,
    privilege_routes,
    spawn_client: ClientSpawner,
):
    """Test that a request to a non-public endpoint fails with a 401 status code."""
    client = await spawn_client(
        addon_route_table=privilege_routes(DefaultRoutePolicy),
        administrator=administrator,
        authenticated=authenticated,
    )

    for url in ["/view", "/func"]:
        for method in ["get", "post", "patch", "put", "delete"]:
            if method in ("get", "delete"):
                resp = await getattr(client, method)(url)
            else:
                resp = await getattr(client, method)(url, {"is_default_test": True})

            if authenticated is False:
                assert (resp.status, await resp.json()) == (
                    401,
                    {
                        "id": "unauthorized",
                        "message": "Requires authorization",
                    },
                )
            else:
                assert resp.status in (200, 201, 204)


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("authenticated", [True, False])
async def test_no_policy(
    administrator: bool,
    authenticated: bool,
    privilege_routes,
    spawn_client: ClientSpawner,
):
    """Test that routes fallback on the default if they have no policy explicitly defined."""
    client = await spawn_client(
        addon_route_table=privilege_routes(PublicRoutePolicy),
        administrator=administrator,
        authenticated=authenticated,
    )

    for url in ("/no_policy_view", "/no_policy_func"):
        for method in ("get", "post", "patch", "put", "delete"):
            if method in ("get", "delete"):
                resp = await getattr(client, method)(url)
            else:
                resp = await getattr(client, method)(url, {"is_public_test": True})

            if authenticated:
                assert resp.status in (200, 201, 204)
            else:
                assert (resp.status, await resp.json()) == (
                    401,
                    {
                        "id": "unauthorized",
                        "message": "Requires authorization",
                    },
                )


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("authenticated", [True, False])
async def test_administrator(
    administrator: bool,
    authenticated: bool,
    spawn_client: ClientSpawner,
    privilege_routes,
):
    """Test that only authenticated, administrator clients can access admin endpoints."""
    client = await spawn_client(
        addon_route_table=privilege_routes(
            AdministratorRoutePolicy(AdministratorRole.BASE),
        ),
        administrator=administrator,
        authenticated=authenticated,
    )

    for url in ["/view", "/func"]:
        for method in ["get", "post", "patch", "put", "delete"]:
            if method in ("get", "delete"):
                resp = await getattr(client, method)(url)
            else:
                resp = await getattr(client, method)(url, {"test": True})

            if authenticated and administrator:
                # The client can access the route.
                assert resp.status in (200, 201, 204)

            elif authenticated:
                # The client is authenticated but is not an administrator.
                assert resp.status == 403
                assert await resp.json() == {
                    "id": "forbidden",
                    "message": "Requires administrative privilege",
                }

            else:
                # The client is not authenticated.
                assert resp.status == 401
                assert await resp.json() == {
                    "id": "unauthorized",
                    "message": "Requires authorization",
                }


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("authenticated", [True, False])
@pytest.mark.parametrize("has_permission", [True, False])
async def test_permissions(
    administrator: bool,
    authenticated: bool,
    has_permission: bool,
    spawn_client: ClientSpawner,
    privilege_routes,
):
    client = await spawn_client(
        addon_route_table=privilege_routes(
            PermissionRoutePolicy(LegacyPermission.CREATE_SAMPLE),
        ),
        administrator=administrator,
        authenticated=authenticated,
        permissions=(
            [LegacyPermission.CREATE_SAMPLE, LegacyPermission.MODIFY_SUBTRACTION]
            if has_permission
            else [Permission.modify_subtraction]
        ),
    )

    for url in ["/view", "/func"]:
        for method in ["get", "post", "patch", "put", "delete"]:
            if method in ("get", "delete"):
                resp = await getattr(client, method)(url)
            else:
                resp = await getattr(client, method)(url, {"test": True})

            if authenticated and (administrator or has_permission):
                # The client can access the route.
                assert resp.status in (200, 201, 204)

            elif authenticated:
                # The client is authenticated but is not an administrator and does not have the
                # required permission.
                assert resp.status == 403
                assert await resp.json() == {
                    "id": "forbidden",
                    "message": "Not permitted",
                }

            else:
                # The client is not authenticated.
                assert resp.status == 401
                assert await resp.json() == {
                    "id": "unauthorized",
                    "message": "Requires authorization",
                }


async def test_more_than_one_function():
    """Test that attempting to load more than one policy on a function-based route leads to
    a ``PolicyError``.

    """
    routes = Routes()

    with pytest.raises(PolicyError):

        @routes.get("/func")
        @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
        @policy(PublicRoutePolicy)
        async def get(_):
            """An example public route."""
            return json_response({"test_get_func": True}, status=200)


async def test_more_than_one_view(spawn_client):
    """Test that attempting to load more than one policy on a view-based route leads to
    a ``PolicyError``.

    """
    routes = Routes()

    with pytest.raises(PolicyError):

        @routes.view("/view")
        class TooManyPolicies(PydanticView):
            @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
            @policy(PublicRoutePolicy)
            async def get(self):
                """An example public route."""
                return json_response({"test_get": "OK"}, status=200)
