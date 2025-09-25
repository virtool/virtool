import asyncio
from http import HTTPStatus

import arrow
import pytest
from aiohttp import BasicAuth
from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from virtool.account.oas import CreateKeyRequest
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.models import User
from virtool.users.oas import UpdateUserRequest
from virtool.users.utils import Permission, generate_base_permissions
from virtool.workflow.pytest_plugin import StaticTime


async def _create_fake_user_with_permissions(fake: DataFaker, *permissions):
    """Helper to create user with specific permissions."""
    group = await fake.groups.create(
        PermissionsUpdate(**dict.fromkeys(permissions, True))
    )
    return await fake.users.create(groups=[group])


async def test_get(
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(authenticated=True)

    resp = await client.get("/account")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot_recent


class TestUpdate:
    """Test account updates at PATCH /account."""

    client: VirtoolTestClient

    @pytest.fixture(autouse=True)
    async def setup(self, spawn_client: ClientSpawner) -> None:
        self.client = await spawn_client(authenticated=True)

        await get_data_from_app(self.client.app).settings.update(
            UpdateSettingsRequest(minimum_password_length=8),
        )

    async def test_all_valid(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test updating both email and password with valid credentials."""
        initial_resp = await self.client.get("/account")
        initial_data = await initial_resp.json()
        initial_last_password_change = arrow.get(initial_data["last_password_change"])

        resp = await self.client.patch(
            "/account",
            {
                "email": "virtool.devs@gmail.com",
                "password": "foo_bar_1",
                "old_password": "bob_is_testing",
            },
        )

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["email"] == "virtool.devs@gmail.com"

        new_last_password_change = arrow.get(body["last_password_change"])

        # Ensure the change happened recently (within last minute)
        delta = (
            new_last_password_change - initial_last_password_change
        ).total_seconds()

        assert delta > 0
        assert delta < 60

        assert body == snapshot_recent(name="response")

    async def test_good_email(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test updating only email with valid format."""
        resp = await self.client.patch("/account", {"email": "virtool.devs@gmail.com"})

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["email"] == "virtool.devs@gmail.com"
        assert body == snapshot_recent(name="response")

    async def test_invalid_email(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that invalid email format returns 400."""
        resp = await self.client.patch("/account", {"email": "invalid_email@"})

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")

    async def test_short_password(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that short password returns 400."""
        resp = await self.client.patch(
            "/account",
            {"password": "foo", "old_password": "hello_world"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")

    async def test_missing_old_password(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that missing old_password when updating password returns 400."""
        resp = await self.client.patch("/account", {"password": "foo_bar_1"})

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")

    async def test_invalid_credentials(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that wrong old_password returns 400."""
        resp = await self.client.patch(
            "/account",
            {"password": "foo_bar_1", "old_password": "not_right"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")

    async def test_missing_password(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that providing old_password without new password returns 400."""
        resp = await self.client.patch("/account", {"old_password": "hello_world"})

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")

    async def test_valid_password(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test updating password with correct old password."""
        # Get initial account state
        initial_resp = await self.client.get("/account")
        initial_data = await initial_resp.json()
        initial_last_password_change = arrow.get(initial_data["last_password_change"])

        resp = await self.client.patch(
            "/account",
            {"password": "foo_bar_1", "old_password": "bob_is_testing"},
        )

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        # Verify password change timestamp was updated
        new_last_password_change = arrow.get(body["last_password_change"])
        delta = (
            new_last_password_change - initial_last_password_change
        ).total_seconds()
        assert delta > 0
        assert delta < 60

        assert body == snapshot_recent(name="response")

    async def test_password_change_invalidates_sessions(self) -> None:
        """Test that changing password invalidates old sessions and creates new one."""
        from virtool.data.utils import get_data_from_app

        data_layer = get_data_from_app(self.client.app)

        # Get the current user ID from the authenticated client
        user_id = self.client.user.id

        # Create another session for the same user to verify it gets invalidated
        old_session, old_token = await data_layer.sessions.create_authenticated(
            "127.0.0.1", user_id, False
        )

        # Verify the old session exists and is valid
        retrieved_session = await data_layer.sessions.get_authenticated(
            old_session.id, old_token
        )
        assert retrieved_session.id == old_session.id

        # Change password
        resp = await self.client.patch(
            "/account",
            {"password": "new_password_123", "old_password": "bob_is_testing"},
        )
        assert resp.status == HTTPStatus.OK

        # Verify new session cookies were set in response
        assert "session_id" in resp.cookies
        assert "session_token" in resp.cookies
        new_session_id = resp.cookies["session_id"].value
        new_session_token = resp.cookies["session_token"].value

        # Verify the old additional session is now invalid
        try:
            await data_layer.sessions.get_authenticated(old_session.id, old_token)
            # If we get here, the session was not invalidated
            assert False, "Session should have been invalidated but was still valid"
        except ResourceNotFoundError:
            # This is expected - session should be invalidated
            pass

        # Verify the new session is valid
        new_session = await data_layer.sessions.get_authenticated(
            new_session_id, new_session_token
        )
        assert new_session.id == new_session_id
        assert new_session.authentication.user_id == user_id

    async def test_empty_update(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that empty update returns 200 with unchanged account."""
        resp = await self.client.patch("/account", {})

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot_recent(name="response")

    async def test_none_all(
        self,
        snapshot_recent: SnapshotAssertion,
    ):
        """Test that None values for all fields returns 400."""
        resp = await self.client.patch(
            "/account",
            {"email": None, "old_password": None, "password": None},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")


async def test_get_settings(spawn_client: ClientSpawner) -> None:
    """Test that a ``GET /account/settings`` returns the settings for the session user."""
    client = await spawn_client(authenticated=True)

    resp = await client.get("/account/settings")

    assert resp.status == HTTPStatus.OK

    assert await resp.json() == {
        "skip_quick_analyze_dialog": True,
        "show_ids": True,
        "show_versions": True,
        "quick_analyze_workflow": "pathoscope_bowtie",
    }


class TestUpdateSettings:
    """Test account settings updates at PATCH /account/settings."""

    async def test_ok(
        self,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that valid settings updates work correctly."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch("/account/settings", {"show_ids": False})

        assert resp.status == HTTPStatus.OK

        body = await resp.json()
        assert body == snapshot_recent(name="response")

        # Verify the updated value is returned
        assert body["show_ids"] is False

        # Verify other settings remain unchanged
        assert body["show_versions"] is True
        assert body["skip_quick_analyze_dialog"] is True
        assert body["quick_analyze_workflow"] == "pathoscope_bowtie"

    async def test_invalid_input(
        self,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that invalid field names and types return 400."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/account/settings",
            {"foo_bar": True, "show_ids": "foo"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")

    async def test_null_values(
        self,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that null values for settings fields return 400."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/account/settings",
            {
                "show_ids": None,
                "show_versions": None,
                "skip_quick_analyze_dialog": None,
                "quick_analyze_workflow": None,
            },
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == snapshot_recent(name="response")


async def test_get_api_keys(
    data_layer: DataLayer,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
) -> None:
    client = await spawn_client(authenticated=True)

    await data_layer.account.create_key(
        CreateKeyRequest(
            name="Foobar",
            permissions={},
        ),
        client.user.id,
    )

    await data_layer.account.create_key(
        CreateKeyRequest(
            name="Baz",
            permissions={},
        ),
        client.user.id,
    )

    resp = await client.get("/account/keys")

    assert await resp.json() == snapshot_recent


async def test_cannot_list_other_users_keys(
    data_layer: DataLayer,
    fake: DataFaker,
    spawn_client: ClientSpawner,
) -> None:
    """Test that users can only see their own API keys."""
    # Create authenticated client (this creates user1)
    client = await spawn_client(authenticated=True)
    user1 = client.user

    # Create another user
    user2 = await fake.users.create()

    # Create API keys for both users
    await data_layer.account.create_key(
        CreateKeyRequest(name="User1 Key", permissions={}),
        user1.id,
    )

    await data_layer.account.create_key(
        CreateKeyRequest(name="User2 Key", permissions={}),
        user2.id,
    )

    resp = await client.get("/account/keys")

    assert resp.status == HTTPStatus.OK
    keys = await resp.json()

    # Should only see user1's key, not user2's
    assert len(keys) == 1
    assert keys[0]["name"] == "User1 Key"


class TestCreateAPIKey:
    @pytest.mark.parametrize("has_perm", [True, False])
    @pytest.mark.parametrize("req_perm", [True, False])
    async def test(
        self,
        has_perm: bool,
        req_perm: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ) -> None:
        """Test that creation of an API key functions properly. Check that different permission inputs work."""
        mocker.patch(
            "virtool.utils.generate_key",
            return_value=("raw_key", "hashed_key"),
        )

        group = await fake.groups.create(
            PermissionsUpdate(**{Permission.create_sample: True}),
        )

        client = await spawn_client(authenticated=True)

        if has_perm:
            await data_layer.users.update(
                client.user.id,
                UpdateUserRequest(groups=[group.id]),
            )

        body = {"name": "Foobar"}

        if req_perm:
            body["permissions"] = {Permission.create_sample.value: True}

        resp = await client.post("/account/keys", body)

        assert resp.status == 201
        assert await resp.json() == snapshot

    async def test_naming(
        self,
        mocker,
        snapshot: SnapshotAssertion,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ) -> None:
        """Test that uniqueness is ensured on the ``id`` field."""
        mocker.patch(
            "virtool.utils.generate_key",
            return_value=("raw_key", "hashed_key"),
        )

        client = await spawn_client(authenticated=True)

        await mongo.keys.insert_one(
            {"_id": "foobar", "id": "foobar_0", "name": "Foobar"},
        )

        body = {"name": "Foobar"}

        resp = await client.post("/account/keys", body)

        assert resp.status == 201
        assert await resp.json() == snapshot
        assert await mongo.keys.find_one({"id": "foobar_1"}) == snapshot

    async def test_permission_exceeds_user_create(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test that API key permissions are limited to user's actual permissions on retrieval."""
        client = await spawn_client(
            authenticated=True, permissions=[Permission.create_sample]
        )

        resp = await client.post(
            "/account/keys",
            {
                "name": "Test Key",
                "permissions": {
                    Permission.create_sample.value: True,
                    Permission.modify_subtraction.value: True,  # User doesn't have this
                },
            },
        )

        assert resp.status == 201
        body = await resp.json()

        assert body["permissions"][Permission.create_sample.value] is True
        assert body["permissions"][Permission.modify_subtraction.value] is False

    async def test_permission_inheritance_multiple_groups(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test that API keys inherit the union of group permissions."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample, Permission.modify_subtraction],
        )

        resp = await client.post(
            "/account/keys",
            {
                "name": "Test Key",
                "permissions": {
                    Permission.create_sample.value: True,
                    Permission.modify_subtraction.value: True,
                },
            },
        )

        assert resp.status == 201
        body = await resp.json()

        assert body["permissions"][Permission.create_sample.value] is True
        assert body["permissions"][Permission.modify_subtraction.value] is True

    async def test_admin_can_grant_any_permission(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        data_layer: DataLayer,
    ) -> None:
        """Test that admin users can grant any permission to their own keys."""
        client = await spawn_client(authenticated=True, administrator=True)

        all_permissions = dict.fromkeys(generate_base_permissions(), True)

        resp = await client.post(
            "/account/keys", {"name": "Admin Key", "permissions": all_permissions}
        )

        assert resp.status == 201
        body = await resp.json()

        for perm in Permission:
            assert body["permissions"][perm.value] is True


class TestUpdateAPIKey:
    @pytest.mark.parametrize("has_admin", [True, False])
    @pytest.mark.parametrize("has_perm", [True, False, "missing"])
    async def test(
        self,
        has_admin: bool,
        has_perm: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ) -> None:
        client = await spawn_client(authenticated=True)

        group = await fake.groups.create(
            permissions=PermissionsUpdate(
                create_sample=True,
                modify_subtraction=(has_perm if has_perm != "missing" else False),
            ),
        )

        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(administrator=has_admin, groups=[group.id]),
        )

        await mongo.keys.insert_one(
            {
                "_id": "foobar",
                "id": "foobar_0",
                "name": "Foobar",
                "created_at": static_time.datetime,
                "administrator": True,
                "user": {"id": client.user.id},
                "groups": [],
                "permissions": {p.value: False for p in Permission},
            },
        )

        data = {
            "permissions": {
                Permission.create_sample.value: True,
                Permission.modify_subtraction.value: True,
            },
        }

        if has_perm == "missing":
            data = {}

        resp = await client.patch(
            "/account/keys/foobar_0",
            data,
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot
        assert await mongo.keys.find_one() == snapshot

    async def test_not_found(
        self, snapshot: SnapshotAssertion, spawn_client: ClientSpawner
    ) -> None:
        """Test that a 404 is returned when the key is not found."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/account/keys/foobar_0",
            {"permissions": {Permission.create_sample.value: True}},
        )

        assert resp.status == 404
        assert await resp.json() == snapshot

    async def test_permission_update_cannot_escalate(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        mongo: Mongo,
    ) -> None:
        """Test that users cannot escalate key permissions beyond their own."""
        client = await spawn_client(
            authenticated=True, permissions=[Permission.create_sample]
        )

        resp = await client.post(
            "/account/keys", {"name": "Test Key", "permissions": {}}
        )
        key_id = (await resp.json())["id"]

        resp = await client.patch(
            f"/account/keys/{key_id}",
            {"permissions": {Permission.modify_subtraction.value: True}},
        )

        assert resp.status == 200
        body = await resp.json()

        assert body["permissions"][Permission.modify_subtraction.value] is False

    async def test_cannot_modify_other_users_key(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        data_layer: DataLayer,
    ) -> None:
        """Test that users cannot modify another user's API key."""
        other_user = await fake.users.create()

        _, other_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Other User Key", permissions=PermissionsUpdate()),
            other_user.id,
        )

        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            f"/account/keys/{other_key.id}",
            {"permissions": {Permission.create_sample.value: True}},
        )

        assert resp.status == 500

    async def test_permission_revocation(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test that permissions can be revoked from a key."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample, Permission.modify_subtraction],
        )

        resp = await client.post(
            "/account/keys",
            {
                "name": "Test Key",
                "permissions": {
                    Permission.create_sample.value: True,
                    Permission.modify_subtraction.value: True,
                },
            },
        )
        key_id = (await resp.json())["id"]

        resp = await client.patch(
            f"/account/keys/{key_id}",
            {"permissions": {Permission.modify_subtraction.value: False}},
        )

        assert resp.status == 200
        body = await resp.json()

        assert body["permissions"][Permission.create_sample.value] is True
        assert body["permissions"][Permission.modify_subtraction.value] is False

    async def test_cannot_update_key_without_owning_permission(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        data_layer: DataLayer,
    ) -> None:
        """Test that users cannot grant permissions they no longer have to their keys."""
        # Create a group with specific permissions
        group = await fake.groups.create(
            PermissionsUpdate(create_sample=True, modify_subtraction=True)
        )

        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample, Permission.modify_subtraction],
        )

        # Create an API key with initial permissions
        resp = await client.post(
            "/account/keys",
            {
                "name": "Test Key",
                "permissions": {Permission.create_sample.value: True},
            },
        )
        key_id = (await resp.json())["id"]

        # Remove modify_subtraction permission from user by updating their groups
        empty_group = await fake.groups.create(PermissionsUpdate(create_sample=True))
        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(groups=[empty_group.id]),
        )

        # Try to grant modify_subtraction permission to the key
        resp = await client.patch(
            f"/account/keys/{key_id}",
            {"permissions": {Permission.modify_subtraction.value: True}},
        )

        assert resp.status == 200
        body = await resp.json()

        # The permission should remain False since user no longer has it
        assert body["permissions"][Permission.modify_subtraction.value] is False


class TestLogout:
    client: VirtoolTestClient
    user: User

    @pytest.fixture(autouse=True)
    async def setup(self, fake: DataFaker, spawn_client: ClientSpawner) -> None:
        self.client = await spawn_client()
        self.user = await fake.users.create(password="test_password")

    async def test_double_logout(self) -> None:
        """Test that calling logout twice doesn't cause errors or unexpected behavior."""
        login_resp = await self.client.post(
            "/account/login",
            {"handle": self.user.handle, "password": "test_password"},
        )
        assert login_resp.status == HTTPStatus.CREATED

        resp = await self.client.get("/account")
        assert resp.status == HTTPStatus.OK

        logout_resp = await self.client.get("/account/logout")
        assert logout_resp.status == HTTPStatus.OK

        resp = await self.client.get("/account")
        assert resp.status == HTTPStatus.UNAUTHORIZED

        second_logout_resp = await self.client.get("/account/logout")
        assert second_logout_resp.status == HTTPStatus.OK

        resp = await self.client.get("/account")
        assert resp.status == HTTPStatus.UNAUTHORIZED

    async def test_cross_session(
        self, spawn_client: ClientSpawner, fake: DataFaker
    ) -> None:
        """Test that logging out one session doesn't affect other active sessions."""
        user_1 = await fake.users.create(password="test_password_1", handle="user_1")
        user_2 = await fake.users.create(password="test_password_2", handle="user_2")

        client_1 = await spawn_client()
        client_2 = await spawn_client()

        login_resp_1 = await client_1.post(
            "/account/login",
            {"handle": user_1.handle, "password": "test_password_1"},
        )
        assert login_resp_1.status == HTTPStatus.CREATED

        login_resp_2 = await client_2.post(
            "/account/login",
            {"handle": user_2.handle, "password": "test_password_2"},
        )
        assert login_resp_2.status == HTTPStatus.CREATED

        resp_1 = await client_1.get("/account")
        assert resp_1.status == HTTPStatus.OK

        resp_2 = await client_2.get("/account")
        assert resp_2.status == HTTPStatus.OK

        logout_resp_1 = await client_1.get("/account/logout")
        assert logout_resp_1.status == HTTPStatus.OK

        resp_1 = await client_1.get("/account")
        assert resp_1.status == HTTPStatus.UNAUTHORIZED

        resp_2 = await client_2.get("/account")
        assert resp_2.status == HTTPStatus.OK

    async def test_concurrent_logout(self) -> None:
        """Test logout behavior under concurrent requests."""
        login_resp = await self.client.post(
            "/account/login",
            {"handle": self.user.handle, "password": "test_password"},
        )
        assert login_resp.status == HTTPStatus.CREATED

        resp = await self.client.get("/account")
        assert resp.status == HTTPStatus.OK

        logout_task = self.client.get("/account/logout")
        account_task = self.client.get("/account")

        logout_resp, account_resp = await asyncio.gather(logout_task, account_task)

        assert logout_resp.status == HTTPStatus.OK
        assert account_resp.status in [HTTPStatus.OK, HTTPStatus.UNAUTHORIZED]

        final_resp = await self.client.get("/account")
        assert final_resp.status == HTTPStatus.UNAUTHORIZED

    async def test_api_keys_remain_valid_after_logout(
        self,
        data_layer: DataLayer,
    ) -> None:
        """Test that API keys remain valid after user logs out."""
        # Login
        login_resp = await self.client.post(
            "/account/login",
            {"handle": self.user.handle, "password": "test_password"},
        )
        assert login_resp.status == HTTPStatus.CREATED

        # Create an API key while logged in
        raw_key, api_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Test Key", permissions={}),
            self.user.id,
        )

        # Logout
        logout_resp = await self.client.get("/account/logout")
        assert logout_resp.status == HTTPStatus.OK

        # Verify session is logged out
        resp = await self.client.get("/account")
        assert resp.status == HTTPStatus.UNAUTHORIZED

        # API key should still work even after logout
        auth_header = BasicAuth(self.user.handle, raw_key).encode()
        resp = await self.client.get("/account", headers={"Authorization": auth_header})
        assert resp.status == HTTPStatus.OK


class TestDelete:
    """Test API key deletion functionality."""

    @pytest.mark.parametrize("error", [None, "404"])
    async def test_remove_single_key(
        self,
        error: str | None,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        snapshot: SnapshotAssertion,
    ) -> None:
        """Test deleting a single API key."""
        client = await spawn_client(authenticated=True)

        if error is None:
            await mongo.keys.insert_one(
                {
                    "_id": "foobar",
                    "id": "foobar_0",
                    "name": "Foobar",
                    "user": {"id": client.user.id},
                },
            )

        resp = await client.delete("/account/keys/foobar_0")

        if error is None:
            assert resp.status == 204
            assert await mongo.keys.count_documents({}) == 0

        else:
            assert resp.status == 404
            assert await resp.json() == {"id": "not_found", "message": "Not found"}

    async def test_remove_all_keys(
        self,
        fake: DataFaker,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test deleting all API keys for a user."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.keys.insert_many(
            [
                {
                    "_id": "hello_world",
                    "id": "hello_world_0",
                    "user": {"id": client.user.id},
                },
                {"_id": "foobar", "id": "foobar_0", "user": {"id": client.user.id}},
                {"_id": "baz", "id": "baz_0", "user": {"id": user.id}},
            ],
            session=None,
        )

        resp = await client.delete("/account/keys")

        assert resp.status == 204

        assert await mongo.keys.find().to_list(None) == [
            {"_id": "baz", "id": "baz_0", "user": {"id": user.id}},
        ]

    async def test_cannot_delete_other_users_key(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        data_layer: DataLayer,
    ) -> None:
        """Test that users cannot delete another user's API key."""
        # Create authenticated client (this creates user1)
        client = await spawn_client(authenticated=True)

        # Create another user
        user2 = await fake.users.create()

        # Create an API key for user2
        _, user2_key = await data_layer.account.create_key(
            CreateKeyRequest(name="User2 Key", permissions={}),
            user2.id,
        )

        # Try to delete user2's key
        resp = await client.delete(f"/account/keys/{user2_key.id}")

        # Should return 404 (not 403) to avoid information leakage
        assert resp.status == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/account"),
        ("PATCH", "/account"),
        ("GET", "/account/settings"),
        ("PATCH", "/account/settings"),
        ("PATCH", "/account/settings"),
        ("GET", "/account/keys"),
        ("POST", "/account/keys"),
        ("PATCH", "/account/keys/foobar"),
        ("DELETE", "/account/keys/foobar"),
        ("DELETE", "/account/keys"),
    ],
)
async def test_requires_authorization(
    method: str, path: str, spawn_client: ClientSpawner
) -> None:
    """Test that a '401 Requires authorization' response is sent when the session is not
    authenticated.

    """
    client = await spawn_client()

    if method == "GET":
        resp = await client.get(path)
    elif method == "POST":
        resp = await client.post(path, {})
    elif method == "PATCH":
        resp = await client.patch(path, {})
    else:
        resp = await client.delete(path)

    assert await resp.json() == {
        "id": "unauthorized",
        "message": "Requires authorization",
    }

    assert resp.status == 401


@pytest.mark.parametrize("value", ["valid_permissions", "invalid_permissions"])
async def test_is_permission_dict(
    value: str, spawn_client: ClientSpawner, resp_is
) -> None:
    """Tests that when an invalid permission is used, validators.is_permission_dict raises a 422 error."""
    client = await spawn_client(authenticated=True)

    permissions = {
        Permission.cancel_job.value: True,
        Permission.create_ref.value: True,
        Permission.create_sample.value: True,
        Permission.modify_hmm.value: True,
    }

    if value == "invalid_permissions":
        permissions["foo"] = True

    data = {"permissions": permissions}

    resp = await client.patch("/account/keys/foo", data=data)

    if value == "valid_permissions":
        await resp_is.not_found(resp)
    else:
        assert resp.status == 404


@pytest.mark.parametrize("value", ["valid_email", "invalid_email"])
async def test_is_valid_email(value: str, spawn_client: ClientSpawner, resp_is) -> None:
    """Tests that when an invalid email is used, validators.is_valid_email raises a 422 error."""
    client = await spawn_client(authenticated=True)

    data = {
        "email": "valid@email.ca" if value == "valid_email" else "-foo-bar-@baz!.ca",
        "old_password": "old_password",
        "password": "password",
    }

    resp = await client.patch("/account", data=data)

    if value == "valid_email":
        await resp_is.bad_request(resp, "Invalid credentials")
    else:
        assert resp.status == 400
        assert await resp.json() == [
            {
                "loc": ["email"],
                "msg": "The format of the email is invalid",
                "type": "value_error",
                "in": "body",
            },
        ]


class TestLogin:
    client: VirtoolTestClient
    user: User

    @pytest.fixture(autouse=True)
    async def setup(self, fake: DataFaker, spawn_client: ClientSpawner) -> None:
        self.client = await spawn_client()
        self.user = await fake.users.create(password="dummy_password")

    async def test_ok(self) -> None:
        """Test that login works with valid credentials."""
        resp = await self.client.post(
            "/account/login",
            {"handle": self.user.handle, "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.CREATED

        assert "session_id" in resp.cookies

        # Test if we can access authenticated endpoints after login
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.OK

    async def test_username_backward_compatibility(self) -> None:
        """Test that login works with username field for backward compatibility.

        TODO: Remove this test once username support is deprecated.
        """
        resp = await self.client.post(
            "/account/login",
            {"username": self.user.handle, "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.CREATED

        assert "session_id" in resp.cookies

        # Test if we can access authenticated endpoints after login
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.OK

    async def test_wrong_handle(self) -> None:
        """Test that login fails with wrong handle."""
        resp = await self.client.post(
            "/account/login",
            {"handle": "nonexistent", "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid handle or password.",
        }

        assert "session_id" not in resp.cookies

        # Verify we cannot access authenticated endpoints
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.UNAUTHORIZED

    async def test_wrong_password(self) -> None:
        """Test that login fails with wrong password."""
        resp = await self.client.post(
            "/account/login",
            {"handle": self.user.handle, "password": "wrong_password"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid handle or password.",
        }

        assert "session_id" not in resp.cookies

        # Verify we cannot access authenticated endpoints
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.UNAUTHORIZED

    async def test_missing_remember(self) -> None:
        """Test that login works when remember field is missing."""
        resp = await self.client.post(
            "/account/login",
            {"handle": self.user.handle, "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.CREATED

        assert "session_id" in resp.cookies

    async def test_remember_is_none(self) -> None:
        """Test that login fails when remember field is None."""
        resp = await self.client.post(
            "/account/login",
            {
                "handle": self.user.handle,
                "password": "dummy_password",
                "remember": None,
            },
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == [
            {
                "in": "body",
                "loc": ["remember"],
                "msg": "Value may not be null",
                "type": "value_error",
            }
        ]

        assert "session_id" in resp.cookies

    async def test_administrator_login(self, fake: DataFaker) -> None:
        """Test that login works with administrator user and can access admin endpoints."""
        admin_user = await fake.users.create(
            administrator_role=AdministratorRole.FULL, password="admin_password"
        )

        resp = await self.client.post(
            "/account/login",
            {"handle": admin_user.handle, "password": "admin_password"},
        )

        assert resp.status == HTTPStatus.CREATED

        assert "session_id" in resp.cookies
        assert "session_token" in resp.cookies

        # Test if we can access authenticated endpoints after login
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.OK

        # Test if we can access admin-only endpoints
        admin_resp = await self.client.get("/admin/roles")
        assert admin_resp.status == HTTPStatus.OK


async def test_logout(spawn_client: ClientSpawner, fake: DataFaker) -> None:
    """Test that calling the logout endpoint results in the current session being removed and the user being logged
    out.

    """
    # Create a new user with a known password
    user = await fake.users.create(password="test_password")

    # Spawn an unauthenticated client
    client = await spawn_client()

    # Login
    login_resp = await client.post(
        "/account/login",
        {"handle": user.handle, "password": "test_password"},
    )
    assert login_resp.status == HTTPStatus.CREATED

    # Get both session cookies from login
    assert "session_id" in login_resp.cookies
    assert "session_token" in login_resp.cookies
    login_session_id = login_resp.cookies["session_id"].value
    login_session_token = login_resp.cookies["session_token"].value
    assert login_session_token != ""  # Should have a real token value

    # Make sure the session is authorized
    resp = await client.get("/account")
    assert resp.status == HTTPStatus.OK

    # Logout
    logout_resp = await client.get("/account/logout")
    assert logout_resp.status == HTTPStatus.OK

    # Check logout cookies
    assert "session_id" in logout_resp.cookies
    assert "session_token" in logout_resp.cookies
    assert logout_resp.cookies["session_token"].value == ""

    # Verify session_id changed after logout
    logout_session_id = logout_resp.cookies["session_id"].value
    assert login_session_id != logout_session_id

    # Make sure that the session is no longer authorized
    resp = await client.get("/account")
    assert resp.status == HTTPStatus.UNAUTHORIZED

    # Verify that the old session token is truly invalidated
    # Try using the old session credentials manually
    old_cookies = {
        "session_id": login_session_id,
        "session_token": login_session_token,
    }
    invalid_resp = await client.get("/account", cookies=old_cookies)
    assert invalid_resp.status == HTTPStatus.UNAUTHORIZED


class TestLoginReset:
    """Test password reset flow after forced login."""

    client: VirtoolTestClient
    user: User
    reset_code: str

    @pytest.fixture(autouse=True)
    async def setup(self, data_layer: DataLayer, spawn_client: ClientSpawner) -> None:
        self.client = await spawn_client()
        self.user = await data_layer.users.create(
            "testuser", "hello_world", force_reset=True
        )

        # Perform login that triggers reset
        resp = await self.client.post(
            "/account/login",
            {
                "handle": self.user.handle,
                "password": "hello_world",
            },
        )

        reset_json_data = await resp.json()
        self.reset_code = reset_json_data.get("reset_code")

        assert "session_id" in resp.cookies
        assert self.reset_code is not None
        assert reset_json_data.get("reset") is True

    async def test_ok(self) -> None:
        """Test successful password reset with correct reset code."""
        resp = await self.client.post(
            "/account/reset",
            {"password": "new_password123", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.OK

        body = await resp.json()
        assert body == {"login": False, "reset": False}

    async def test_old_password_cannot_be_reused_for_reset(self) -> None:
        """Test that users cannot reset to their current password."""
        resp = await self.client.post(
            "/account/reset",
            {"password": "hello_world", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST

    async def test_reset_invalidates_old_sessions(self) -> None:
        """Test that password reset invalidates existing sessions."""
        from virtool.data.utils import get_data_from_app

        data_layer = get_data_from_app(self.client.app)

        # Create another session for the same user
        old_session, old_token = await data_layer.sessions.create_authenticated(
            "127.0.0.1", str(self.user.id), False
        )

        # Reset password
        resp = await self.client.post(
            "/account/reset",
            {"password": "new_password123", "reset_code": self.reset_code},
        )
        assert resp.status == HTTPStatus.OK

        # Old session should be invalidated
        from virtool.data.errors import ResourceNotFoundError

        try:
            await data_layer.sessions.get_authenticated(old_session.id, old_token)
            assert False, "Old session should have been invalidated"
        except ResourceNotFoundError:
            pass

    async def test_wrong_reset_code(self) -> None:
        """Test that reset fails with incorrect reset code."""
        resp = await self.client.post(
            "/account/reset",
            {"password": "new_password123", "reset_code": "wrong_code"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid session",
        }

    async def test_short_password(self) -> None:
        """Test that reset fails when new password is too short."""
        resp = await self.client.post(
            "/account/reset",
            {"password": "invalid", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Password does not meet minimum length requirement (8)",
        }

    async def test_protected_endpoint_access(self) -> None:
        """Test that protected endpoints cannot be accessed until reset is complete."""
        resp = await self.client.post(
            "/account/keys",
            {"password": "invalid", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.UNAUTHORIZED
        assert await resp.json() == {
            "id": "unauthorized",
            "message": "Requires authorization",
        }

    async def test_missing_reset_code(self) -> None:
        """Test that reset fails when reset_code is not provided."""
        resp = await self.client.post(
            "/account/reset",
            {"password": "new_password123"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST

    async def test_empty_password(self) -> None:
        """Test that reset fails when password is empty."""
        resp = await self.client.post(
            "/account/reset",
            {"password": "", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST

    async def test_force_reset_prevents_normal_operations(self) -> None:
        """Test that protected endpoints cannot be accessed until reset is complete."""
        resp = await self.client.get("/account/keys")

        assert resp.status == HTTPStatus.UNAUTHORIZED
        assert await resp.json() == {
            "id": "unauthorized",
            "message": "Requires authorization",
        }

    async def test_reset_code_single_use(self) -> None:
        """Test that reset code cannot be reused after successful reset."""
        # First reset - should succeed
        resp = await self.client.post(
            "/account/reset",
            {"password": "first_password123", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert body == {"login": False, "reset": False}

        # Try to use the same reset code again - should fail
        resp = await self.client.post(
            "/account/reset",
            {"password": "second_password123", "reset_code": self.reset_code},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid session",
        }
