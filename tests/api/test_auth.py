from collections.abc import Awaitable, Callable
from http import HTTPStatus

import pytest
from aiohttp import BasicAuth
from aiohttp.web_exceptions import HTTPNoContent
from aiohttp.web_response import json_response
from aiohttp_pydantic import PydanticView

from tests.fixtures.client import ClientSpawner, JobClientSpawner, VirtoolTestClient
from virtool.account.oas import CreateKeyRequest
from virtool.api.policy import PermissionRoutePolicy, PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.models.enums import Permission
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.oas import UpdateUserRequest
from virtool.utils import hash_key


class TestAPIKeyAuthentication:
    @pytest.fixture(autouse=True)
    async def setup(self, data_layer: DataLayer, fake: DataFaker):
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
        data_layer: DataLayer,
        spawn_client: ClientSpawner,
    ) -> Callable[..., Awaitable[VirtoolTestClient]]:
        """Fixture that returns a function to create API key authenticated clients."""

        async def func(
            user, permissions: PermissionsUpdate, **kwargs
        ) -> VirtoolTestClient:
            raw_key, _ = await data_layer.account.create_key(
                CreateKeyRequest(name="Test Key", permissions=permissions),
                user.id,
            )
            return await spawn_client(auth=BasicAuth(user.handle, raw_key), **kwargs)

        return func

    async def test_ok(self, spawn_authenticated_client):
        """Test successful API key authentication with valid credentials."""
        client = await spawn_authenticated_client(
            self.user,
            PermissionsUpdate(create_sample=True, modify_subtraction=True),
        )

        resp = await client.get("/samples")

        assert resp.status == HTTPStatus.OK

    async def test_invalid_key(self, spawn_client: ClientSpawner):
        """Test authentication fails with invalid API key."""
        client = await spawn_client(auth=BasicAuth(self.user.handle, "invalid_key"))

        resp = await client.get("/samples")

        assert resp.status == HTTPStatus.UNAUTHORIZED

    async def test_inactive_user(
        self,
        data_layer: DataLayer,
        spawn_client: ClientSpawner,
    ):
        """Test authentication fails when user is inactive."""
        raw_key, _ = await data_layer.account.create_key(
            CreateKeyRequest(
                name="Test Key",
                permissions=PermissionsUpdate(create_sample=True),
            ),
            self.user.id,
        )

        await data_layer.users.update(self.user.id, UpdateUserRequest(active=False))

        client = await spawn_client(auth=BasicAuth(self.user.handle, raw_key))

        resp = await client.get("/samples")

        assert resp.status == HTTPStatus.UNAUTHORIZED

    async def test_malformed_header(self, spawn_client: ClientSpawner):
        """Test authentication fails with malformed Authorization header."""
        client = await spawn_client()

        resp = await client.get("/samples", headers={"AUTHORIZATION": "malformed"})

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

        resp = await client.get("/samples")

        assert resp.status == HTTPStatus.OK

    async def test_handle_not_found(self, spawn_client: ClientSpawner):
        """Test authentication fails with non-existent user handle."""
        client = await spawn_client(
            auth=BasicAuth("nonexistent_handle", "some_key"),
        )

        resp = await client.get("/samples")

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

        resp = await client.get("/users")

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
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that Authorization header takes precedence over session cookies."""
        api_key_group = await fake.groups.create(
            PermissionsUpdate(create_sample=True),
        )

        api_key_user = await fake.users.create(groups=[api_key_group])

        raw_key, _ = await data_layer.account.create_key(
            CreateKeyRequest(
                name="Precedence Key",
                permissions=PermissionsUpdate(create_sample=True),
            ),
            api_key_user.id,
        )

        session_client = await spawn_client(authenticated=True)

        session_user_id = session_client.user.id

        auth_header = BasicAuth(api_key_user.handle, raw_key).encode()

        resp = await session_client.get(
            "/account",
            headers={"Authorization": auth_header},
        )

        assert resp.status == HTTPStatus.OK
        account = await resp.json()
        assert account["id"] == api_key_user.id
        assert account["id"] != session_user_id


class TestJobAuthentication:
    async def test_root_succeeds(self, spawn_job_client: JobClientSpawner):
        """Check that a request against the job accessible root URL (GET /) succeeds."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/")

        assert resp.status == HTTPStatus.OK

    async def test_unauthenticated_root_fails(self, spawn_job_client: JobClientSpawner):
        """Check that a request against the root API URL"""
        client = await spawn_job_client(authenticated=False)

        resp = await client.get("/")

        assert resp.status == 401

    async def test_protected_fails(
        self,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Check that a request against GET /samples using job authentication fails.

        This path is not accessible to jobs.

        """
        key = "bar"

        client = await spawn_client(auth=BasicAuth("job-foo", key))

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(minimum_password_length=8),
        )

        await mongo.jobs.insert_one({"_id": "foo", "key": hash_key(key)})

        resp = await client.get("/samples")

        assert resp.status == 401
