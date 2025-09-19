from http import HTTPStatus

import arrow
import pytest
from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.models import User
from virtool.users.oas import UpdateUserRequest
from virtool.users.utils import Permission, hash_password


async def test_get(
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    resp = await client.get("/account")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestUpdate:
    """Test account updates at PATCH /account."""

    client: VirtoolTestClient

    @pytest.fixture(autouse=True)
    async def setup(self, spawn_client: ClientSpawner):
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


async def test_get_settings(spawn_client: ClientSpawner):
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
    fake: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    snapshot: SnapshotAssertion,
    static_time,
):
    client = await spawn_client(authenticated=True)

    group = await fake.groups.create()

    await mongo.keys.insert_many(
        [
            {
                "_id": "abc123",
                "id": "foobar_0",
                "name": "Foobar",
                "user": {"id": client.user.id},
                "created_at": static_time.datetime,
                "administrator": True,
                "groups": [group.id],
                "permissions": {},
            },
            {
                "_id": "xyz321",
                "id": "baz_1",
                "name": "Baz",
                "user": {"id": client.user.id},
                "created_at": static_time.datetime,
                "administrator": False,
                "groups": [],
                "permissions": {},
            },
        ],
        session=None,
    )

    resp = await client.get("/account/keys")

    assert await resp.json() == snapshot


class TestCreateAPIKey:
    @pytest.mark.parametrize("has_perm", [True, False])
    @pytest.mark.parametrize("req_perm", [True, False])
    async def test(
        self,
        has_perm,
        req_perm,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
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
        snapshot,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time,
    ):
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
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
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

    async def test_not_found(self, snapshot, spawn_client: ClientSpawner):
        """Test that a 404 is returned when the key is not found."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/account/keys/foobar_0",
            {"permissions": {Permission.create_sample.value: True}},
        )

        assert resp.status == 404
        assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_remove_api_key(
    error,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    snapshot,
):
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
        assert await resp.json() == snapshot


async def test_remove_all_api_keys(
    fake: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
):
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


async def test_logout(spawn_client):
    """Test that calling the logout endpoint results in the current session being removed and the user being logged
    out.

    """
    client = await spawn_client(authenticated=True)

    # Make sure the session is authorized
    resp = await client.get("/account")
    assert resp.status == HTTPStatus.OK

    # Logout
    resp = await client.get("/account/logout")
    assert resp.status == HTTPStatus.OK

    # Make sure that the session is no longer authorized
    resp = await client.get("/account")
    assert resp.status == 401


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
async def test_requires_authorization(method: str, path: str, spawn_client):
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
async def test_is_permission_dict(value, spawn_client, resp_is):
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
async def test_is_valid_email(value, spawn_client, resp_is):
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
    async def setup(self, fake: DataFaker, spawn_client: ClientSpawner):
        self.client = await spawn_client()
        self.user = await fake.users.create(password="dummy_password")

    async def test_ok(self):
        """Test that login works with valid credentials."""
        resp = await self.client.post(
            "/account/login",
            {"username": self.user.handle, "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.CREATED

        set_cookie = resp.headers.get("Set-Cookie", "")
        assert "session_id=" in set_cookie

        # Test if we can access authenticated endpoints after login
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.OK

    async def test_wrong_handle(self):
        """Test that login fails with wrong handle."""
        resp = await self.client.post(
            "/account/login",
            {"username": "nonexistent", "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid handle or password.",
        }

        set_cookie = resp.headers.get("Set-Cookie", "")
        assert set_cookie == ""

        # Verify we cannot access authenticated endpoints
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.UNAUTHORIZED

    async def test_wrong_password(self):
        """Test that login fails with wrong password."""
        resp = await self.client.post(
            "/account/login",
            {"username": self.user.handle, "password": "wrong_password"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid handle or password.",
        }

        set_cookie = resp.headers.get("Set-Cookie", "")
        assert set_cookie == ""

        # Verify we cannot access authenticated endpoints
        account_resp = await self.client.get("/account")
        assert account_resp.status == HTTPStatus.UNAUTHORIZED

    async def test_missing_remember(self):
        """Test that login works when remember field is missing."""
        resp = await self.client.post(
            "/account/login",
            {"username": self.user.handle, "password": "dummy_password"},
        )

        assert resp.status == HTTPStatus.CREATED

        set_cookie = resp.headers.get("Set-Cookie", "")
        assert "session_id=" in set_cookie

    async def test_remember_is_none(self):
        """Test that login fails when remember field is None."""
        resp = await self.client.post(
            "/account/login",
            {
                "username": self.user.handle,
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

        set_cookie = resp.headers.get("Set-Cookie", "")
        assert "session_id=" in set_cookie


@pytest.mark.parametrize(
    "request_path,correct_code",
    [
        ("account/keys", True),
        ("account/reset", True),
        ("account/reset", False),
    ],
)
async def test_login_reset(
    spawn_client,
    snapshot,
    fake: DataFaker,
    request_path,
    correct_code,
    data_layer: DataLayer,
) -> None:
    client = await spawn_client(authenticated=False)

    data = {
        "username": "foobar",
        "handle": "foobar",
        "password": "hello_world",
        "force_reset": True,
    }
    await data_layer.users.create("foobar", "hello_world", True)
    resp = await client.post("/account/login", data)
    reset_json_data = await resp.json()

    assert "session_id=session" in resp.headers.get("Set-Cookie")
    assert reset_json_data.get("reset_code") is not None
    assert reset_json_data.get("reset") is True

    reset_data = {
        "password": "invalid",
        "reset_code": reset_json_data.get("reset_code")
        if correct_code
        else "wrong_code",
    }

    resp = await client.post(request_path, reset_data)
    assert await resp.json() == snapshot

    reset_data["password"] = "hello_world"

    resp = await client.post(request_path, reset_data)

    assert await resp.json() == snapshot
