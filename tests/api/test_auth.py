from collections.abc import Awaitable, Callable
from http import HTTPStatus

import pytest
from aiohttp import BasicAuth
from aiohttp.web_exceptions import HTTPNoContent
from aiohttp.web_response import json_response
from aiohttp_pydantic import PydanticView

from tests.fixtures.client import ClientSpawner, JobClientSpawner, VirtoolTestClient
from virtool.api.policy import (
    AdministratorRoutePolicy,
    PermissionRoutePolicy,
    PublicRoutePolicy,
    policy,
)
from virtool.api.routes import Routes
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import Permission
from virtool.models.roles import AdministratorRole
from virtool.users.oas import UpdateUserRequest

authenticated_routes = Routes()
"""Routes that stand in for any authenticated endpoint.

Authentication is a cross-cutting concern, so these tests own their own routes
rather than probing a domain endpoint that may later be dropped.
"""


@authenticated_routes.get("/test_authenticated")
async def get_authenticated(req):
    return json_response({"user_id": req["client"].user_id}, status=200)


@authenticated_routes.get("/test_administrator")
@policy(AdministratorRoutePolicy(AdministratorRole.BASE))
async def get_administrator(_):
    return json_response({"administrator": True}, status=200)


class TestAPIKeyAuthentication:
    @pytest.fixture(autouse=True)
    async def setup(self, fake: DataFaker):
        """Set up a test user with groups and permissions for API key tests."""
        self.group = await fake.groups.create(
            PermissionsUpdate(
                create_sample=True,
                modify_subtraction=True,
                upload_file=True,
            ),
        )

        self.user = await fake.users.create(groups=[self.group])

    @pytest.fixture(autouse=True)
    def spawn_authenticated_client(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> Callable[..., Awaitable[VirtoolTestClient]]:
        """Fixture that returns a function to create API key authenticated clients."""

        async def func(
            user,
            permissions: PermissionsUpdate,
            addon_route_table: Routes = authenticated_routes,
            **kwargs,
        ) -> VirtoolTestClient:
            raw_key, _ = await fake.api_keys.create(user, permissions)

            return await spawn_client(
                auth=BasicAuth(user.handle, raw_key),
                addon_route_table=addon_route_table,
                **kwargs,
            )

        return func

    async def test_ok(self, spawn_authenticated_client):
        """Test successful API key authentication with valid credentials."""
        client = await spawn_authenticated_client(
            self.user,
            PermissionsUpdate(create_sample=True, modify_subtraction=True),
        )

        resp = await client.get("/test_authenticated")

        assert resp.status == HTTPStatus.OK

    async def test_invalid_key(self, spawn_client: ClientSpawner):
        """Test authentication fails with invalid API key."""
        client = await spawn_client(
            auth=BasicAuth(self.user.handle, "invalid_key"),
            addon_route_table=authenticated_routes,
        )

        resp = await client.get("/test_authenticated")

        assert resp.status == HTTPStatus.UNAUTHORIZED

    async def test_inactive_user(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test authentication fails when user is inactive."""
        raw_key, _ = await fake.api_keys.create(
            self.user,
            PermissionsUpdate(create_sample=True),
        )

        await data_layer.users.update(self.user.id, UpdateUserRequest(active=False))

        client = await spawn_client(
            auth=BasicAuth(self.user.handle, raw_key),
            addon_route_table=authenticated_routes,
        )

        resp = await client.get("/test_authenticated")

        assert resp.status == HTTPStatus.UNAUTHORIZED

    async def test_malformed_header(self, spawn_client: ClientSpawner):
        """Test authentication fails with malformed Authorization header."""
        client = await spawn_client(addon_route_table=authenticated_routes)

        resp = await client.get(
            "/test_authenticated",
            headers={"AUTHORIZATION": "malformed"},
        )

        assert resp.status == HTTPStatus.UNAUTHORIZED
        assert (await resp.json())["id"] == "malformed_authorization_header"

    async def test_permission_intersection(self, spawn_authenticated_client):
        """Test that authenticated client has intersection of user and key permissions.

        User has: create_sample, modify_subtraction, upload_file
        Key has: create_sample, modify_hmm
        Expected effective permissions: create_sample (intersection)
        """
        client = await spawn_authenticated_client(
            self.user,
            PermissionsUpdate(create_sample=True, modify_hmm=True),
        )

        resp = await client.get("/test_authenticated")

        assert resp.status == HTTPStatus.OK

    async def test_handle_not_found(self, spawn_client: ClientSpawner):
        """Test authentication fails with non-existent user handle."""
        client = await spawn_client(
            auth=BasicAuth("nonexistent_handle", "some_key"),
            addon_route_table=authenticated_routes,
        )

        resp = await client.get("/test_authenticated")

        assert resp.status == HTTPStatus.UNAUTHORIZED

    async def test_administrator_ok(
        self,
        fake: DataFaker,
        spawn_authenticated_client,
    ):
        """Test that administrator users retain admin role when using API keys."""
        admin_user = await fake.users.create(
            administrator_role=AdministratorRole.FULL,
        )

        client = await spawn_authenticated_client(
            admin_user,
            PermissionsUpdate(create_sample=True),
        )

        resp = await client.get("/test_administrator")

        assert resp.status == HTTPStatus.OK

    async def test_empty_permission_intersection(self, spawn_authenticated_client):
        """Test authentication succeeds but operations fail with no overlapping permissions."""
        routes = Routes()

        @routes.get("/test_permission")
        @policy(PermissionRoutePolicy(Permission.modify_subtraction))
        async def get_test(_):
            return json_response({"success": True}, status=200)

        client = await spawn_authenticated_client(
            self.user,
            PermissionsUpdate(modify_hmm=True),
            addon_route_table=routes,
        )

        resp = await client.get("/test_permission")

        assert resp.status == HTTPStatus.FORBIDDEN

    async def test_write_operations(self, spawn_authenticated_client):
        """Test that API key authentication works for all HTTP methods."""
        routes = Routes()

        @routes.post("/test_write")
        async def post_test(req):
            data = await req.json()
            return json_response({"posted": True, **data}, status=201)

        @routes.put("/test_write")
        async def put_test(req):
            data = await req.json()
            return json_response({"updated": True, **data}, status=200)

        @routes.patch("/test_write")
        async def patch_test(req):
            data = await req.json()
            return json_response({"patched": True, **data}, status=200)

        @routes.delete("/test_write")
        async def delete_test(_):
            raise HTTPNoContent

        client = await spawn_authenticated_client(
            self.user,
            PermissionsUpdate(create_sample=True),
            addon_route_table=routes,
        )

        post_resp = await client.post("/test_write", {"data": "test"})
        assert post_resp.status == HTTPStatus.CREATED

        put_resp = await client.put("/test_write", {"data": "test"})
        assert put_resp.status == HTTPStatus.OK

        patch_resp = await client.patch("/test_write", {"data": "test"})
        assert patch_resp.status == HTTPStatus.OK

        delete_resp = await client.delete("/test_write")
        assert delete_resp.status == HTTPStatus.NO_CONTENT

    async def test_public_route_access(self, spawn_authenticated_client):
        """Test that API key authenticated clients can access public routes."""
        routes = Routes()

        @routes.view("/test_public")
        class PublicTestView(PydanticView):
            @policy(PublicRoutePolicy)
            async def get(self):
                return json_response({"public": True}, status=200)

        client = await spawn_authenticated_client(
            self.user,
            PermissionsUpdate(create_sample=True),
            addon_route_table=routes,
        )

        resp = await client.get("/test_public")

        assert resp.status == HTTPStatus.OK
        assert (await resp.json())["public"] is True

    async def test_authorization_header_precedence(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that Authorization header takes precedence over session cookies."""
        api_key_group = await fake.groups.create(
            PermissionsUpdate(create_sample=True),
        )

        api_key_user = await fake.users.create(groups=[api_key_group])

        raw_key, _ = await fake.api_keys.create(
            api_key_user,
            PermissionsUpdate(create_sample=True),
            name="Precedence Key",
        )

        session_client = await spawn_client(
            authenticated=True,
            addon_route_table=authenticated_routes,
        )

        session_user_id = session_client.user.id

        auth_header = BasicAuth(api_key_user.handle, raw_key).encode()

        resp = await session_client.get(
            "/test_authenticated",
            headers={"Authorization": auth_header},
        )

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert body["user_id"] == api_key_user.id
        assert body["user_id"] != session_user_id


class TestJobAuthentication:
    async def test_root_succeeds(self, spawn_job_client: JobClientSpawner):
        """Check that a request against the job accessible root URL (GET /) succeeds."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/")

        assert resp.status == HTTPStatus.OK

    async def test_protected_fails(self, spawn_client: ClientSpawner):
        """Check that a request against a protected path using job authentication fails.

        Job credentials are not accepted on the public API.
        """
        client = await spawn_client(
            auth=BasicAuth("job-foo", "bar"),
            addon_route_table=authenticated_routes,
        )

        resp = await client.get("/test_authenticated")

        assert resp.status == HTTPStatus.UNAUTHORIZED
