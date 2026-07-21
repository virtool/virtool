from http import HTTPStatus

import arrow
import pytest
from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from virtool.account.oas import CreateKeyRequest
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.settings.oas import UpdateSettingsRequest
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
        "quick_analyze_workflow": "pathoscope",
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
        assert body["quick_analyze_workflow"] == "pathoscope"

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
    async def test_with_permission(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test creating an API key with a permission the user has."""
        group = await fake.groups.create(
            PermissionsUpdate(**{Permission.create_sample: True}),
        )

        client = await spawn_client(authenticated=True)

        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(groups=[group.id]),
        )

        resp = await client.post(
            "/account/keys",
            {"name": "Foobar", "permissions": {Permission.create_sample.value: True}},
        )

        assert resp.status == 201

        response_data = await resp.json()
        assert "key" in response_data
        assert "id" in response_data
        assert response_data["name"] == "Foobar"
        assert "created_at" in response_data
        assert response_data["permissions"][Permission.create_sample.value] is True

    async def test_without_permission(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test creating an API key requesting a permission the user lacks."""
        group = await fake.groups.create(
            PermissionsUpdate(**{Permission.create_sample: True}),
        )

        client = await spawn_client(authenticated=True)

        resp = await client.post(
            "/account/keys",
            {"name": "Foobar", "permissions": {Permission.create_sample.value: True}},
        )

        assert resp.status == 201

        response_data = await resp.json()
        assert "key" in response_data
        assert "id" in response_data
        assert response_data["name"] == "Foobar"
        assert "created_at" in response_data
        assert response_data["permissions"][Permission.create_sample.value] is False

    async def test_no_permissions_requested(
        self,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test creating an API key without requesting any permissions."""
        client = await spawn_client(authenticated=True)

        resp = await client.post("/account/keys", {"name": "Foobar"})

        assert resp.status == 201

        response_data = await resp.json()
        assert "key" in response_data
        assert "id" in response_data
        assert response_data["name"] == "Foobar"
        assert "created_at" in response_data
        assert all(v is False for v in response_data["permissions"].values())

    async def test_naming(
        self,
        spawn_client: ClientSpawner,
    ) -> None:
        """Test that keys sharing a name receive distinct integer ids."""
        client = await spawn_client(authenticated=True)

        resp_1 = await client.post("/account/keys", {"name": "Foobar"})
        assert resp_1.status == 201
        data_1 = await resp_1.json()
        assert isinstance(data_1["id"], int)
        assert data_1["name"] == "Foobar"

        resp_2 = await client.post("/account/keys", {"name": "Foobar"})
        assert resp_2.status == 201
        data_2 = await resp_2.json()
        assert isinstance(data_2["id"], int)
        assert data_2["name"] == "Foobar"

        assert data_1["id"] != data_2["id"]

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
        mocker,
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

        mocker.patch("virtool.utils.generate_key", return_value=("bar", "baz"))

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Foobar", permissions=PermissionsUpdate()),
            client.user.id,
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
            f"/account/keys/{api_key.id}",
            data,
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_not_found(
        self, snapshot: SnapshotAssertion, spawn_client: ClientSpawner
    ) -> None:
        """Test that a 404 is returned when the key is not found."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/account/keys/1",
            {"permissions": {Permission.create_sample.value: True}},
        )

        assert resp.status == 404
        assert await resp.json() == snapshot

    async def test_permission_update_cannot_escalate(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
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

        assert resp.status == 404

        unchanged = await data_layer.account.get_key(other_user.id, other_key.id)
        assert unchanged.permissions.create_sample is False

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


class TestDelete:
    """Test API key deletion functionality."""

    async def test_remove_single_key(
        self,
        data_layer: DataLayer,
        spawn_client: ClientSpawner,
    ) -> None:
        """Deleting a single API key removes it."""
        client = await spawn_client(authenticated=True)

        _, api_key = await data_layer.account.create_key(
            CreateKeyRequest(name="Foobar", permissions=PermissionsUpdate()),
            client.user.id,
        )

        resp = await client.delete(f"/account/keys/{api_key.id}")

        assert resp.status == 204

        list_resp = await client.get("/account/keys")
        assert await list_resp.json() == []

    async def test_remove_single_key_not_found(
        self,
        spawn_client: ClientSpawner,
    ) -> None:
        """Deleting a key that does not exist returns 404."""
        client = await spawn_client(authenticated=True)

        resp = await client.delete("/account/keys/1")

        assert resp.status == 404
        assert await resp.json() == {"id": "not_found", "message": "Not found"}

    async def test_remove_all_keys(
        self,
        data_layer: DataLayer,
        spawn_client: ClientSpawner,
    ) -> None:
        """Deleting all keys removes every key owned by the requesting user."""
        client = await spawn_client(authenticated=True)

        await data_layer.account.create_key(
            CreateKeyRequest(name="Owned One", permissions=PermissionsUpdate()),
            client.user.id,
        )
        await data_layer.account.create_key(
            CreateKeyRequest(name="Owned Two", permissions=PermissionsUpdate()),
            client.user.id,
        )

        resp = await client.delete("/account/keys")

        assert resp.status == 204

        list_resp = await client.get("/account/keys")
        assert await list_resp.json() == []

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
        ("PATCH", "/account/keys/1"),
        ("DELETE", "/account/keys/1"),
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

    resp = await client.patch("/account/keys/1", data=data)

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
