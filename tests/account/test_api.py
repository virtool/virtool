from http import HTTPStatus

import pytest
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest
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


@pytest.mark.parametrize(
    ("body", "status"),
    [
        (
            {
                "email": "virtool.devs@gmail.com",
                "password": "foo_bar_1",
                "old_password": "bob_is_testing",
            },
            200,
        ),
        ({"email": "virtool.devs@gmail.com"}, 200),
        ({"email": "invalid_email@"}, 400),
        ({"password": "foo", "old_password": "hello_world"}, 400),
        ({"password": "foo_bar_1"}, 400),
        ({"password": "foo_bar_1", "old_password": "not_right"}, 400),
        ({"old_password": "hello_world"}, 400),
        ({"password": "foo_bar_1", "old_password": "bob_is_testing"}, 200),
        ({}, 200),
        ({"email": None, "old_password": None, "password": None}, 400),
    ],
    ids=[
        "all_valid",
        "good_email",
        "invalid_email",
        "short_password",
        "missing_old_password",
        "invalid_credentials",
        "missing_password",
        "missing_email",
        "missing_all",
        "none_all",
    ],
)
async def test_update(
    body: dict,
    status: int,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    await get_data_from_app(client.app).settings.update(
        UpdateSettingsRequest(minimum_password_length=8),
    )

    resp = await client.patch("/account", body)

    assert resp.status == status
    assert await resp.json() == snapshot(name="response")


async def test_get_settings(spawn_client):
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
        spawn_client: ClientSpawner,
        snapshot_recent: SnapshotAssertion,
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
        spawn_client: ClientSpawner,
        snapshot_recent: SnapshotAssertion,
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


@pytest.mark.parametrize(
    "body,status",
    [
        ({"username": "foobar", "password": "p@ssword123", "remember": False}, 201),
        ({"username": "oops", "password": "p@ssword123", "remember": False}, 400),
        ({"username": "foobar", "password": "wr0ngp@ssword", "remember": False}, 400),
        ({"username": "foobar", "password": "p@ssword123"}, 201),
        ({"username": "foobar", "password": "p@ssword123", "remember": None}, 400),
    ],
    ids=[
        "all_valid",
        "wrong_handle",
        "wrong_password",
        "missing_remember",
        "remember_is_none",
    ],
)
async def test_login(
    mongo: Mongo,
    spawn_client: ClientSpawner,
    body,
    status,
    snapshot,
):
    client = await spawn_client()

    await mongo.users.insert_one(
        {
            "user_id": "abc123",
            "handle": "foobar",
            "password": hash_password("p@ssword123"),
        },
    )

    resp = await client.post("/account/login", body)

    assert resp.status == status
    assert await resp.json() == snapshot


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
