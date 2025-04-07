from http import HTTPStatus

import pytest
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from tests.fixtures.core import StaticTime
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.mongo.core import Mongo
from virtool.settings.oas import SettingsUpdateRequest
from virtool.users.oas import UserUpdateRequest
from virtool.users.utils import Permission, hash_password


async def test_get(
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time: StaticTime,
):
    """Test that a user can get their account information."""
    client = await spawn_client(authenticated=True)

    resp = await client.get("/account")

    assert resp.status == 200
    assert await resp.json() == snapshot


class TestUpdate:
    client: VirtoolTestClient

    @pytest.fixture(autouse=True)
    async def _setup(self, data_layer: DataLayer, spawn_client: ClientSpawner):
        self.client = await spawn_client(authenticated=True)

        await data_layer.settings.update(
            SettingsUpdateRequest(minimum_password_length=8),
        )

    async def test_ok(self, snapshot_recent: SnapshotAssertion):
        """Test that a user can update their account when all fields are valid."""
        resp = await self.client.patch(
            "/account",
            {
                "email": "virtool.devs@gmail.com",
                "password": "foo_bar_1",
                "old_password": "bob_is_testing",
            },
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot_recent(name="response")

    async def test_invalid_email(self):
        """Test that a user cannot update their account with an invalid email."""
        resp = await self.client.patch(
            "/account",
            {
                "email": "invalid_email@",
            },
        )

        assert resp.status == HTTPStatus.UNPROCESSABLE_ENTITY
        assert await resp.json() == {
            "errors": [
                {
                    "message": "The format of the email is invalid",
                    "field": "email",
                    "in": "body",
                },
            ],
            "id": "invalid_input",
            "message": "Invalid input",
        }

    async def test_password_too_short(self):
        """Test that a user cannot update their account with a password that is too short."""
        resp = await self.client.patch(
            "/account",
            {"password": "foo", "old_password": "hello_world"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Password does not meet minimum length requirement (8)",
        }

    async def test_missing_password(self):
        """Test that a request fails if it only contains one of `password` or
        `old_password`.
        """
        resp = await self.client.patch(
            "/account",
            {"password": "foo_bar_1"},
        )

        assert resp.status == HTTPStatus.UNPROCESSABLE_ENTITY
        assert await resp.json() == {
            "errors": [
                {
                    "field": "",
                    "in": "body",
                    "message": (
                        "The old password needs to be given in order for the password "
                        "to be changed."
                    ),
                },
            ],
            "id": "invalid_input",
            "message": "Invalid input",
        }

    async def test_invalid_credentials(self, snapshot: SnapshotAssertion):
        """Test that a user cannot update their account with invalid credentials."""
        resp = await self.client.patch(
            "/account",
            {"password": "foo_bar_1", "old_password": "not_right"},
        )

        assert resp.status == HTTPStatus.BAD_REQUEST
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Invalid credentials",
        }


async def test_get_settings(spawn_client: ClientSpawner):
    """Test that a ``GET /account/settings`` returns the settings for the session
    user.
    """
    client = await spawn_client(authenticated=True)

    resp = await client.get("/account/settings")

    assert resp.status == HTTPStatus.OK

    assert await resp.json() == {
        "skip_quick_analyze_dialog": True,
        "show_ids": True,
        "show_versions": True,
        "quick_analyze_workflow": "pathoscope_bowtie",
    }


@pytest.mark.parametrize(
    ("data", "status"),
    [
        (
            {"show_ids": False},
            200,
        ),
        ({"foo_bar": True, "show_ids": "foo"}, 422),
        (
            {
                "show_ids": None,
                "show_versions": None,
                "skip_quick_analyze_dialog": None,
                "quick_analyze_workflow": None,
            },
            422,
        ),
    ],
    ids=["valid_input", "invalid_input", "null_values"],
)
async def test_update_settings(
    data: dict,
    status: HTTPStatus,
    spawn_client: ClientSpawner,
    resp_is,
    snapshot: SnapshotAssertion,
):
    """Test that account settings can be updated at ``POST /account/settings`` and that
    requests to ``POST /account/settings`` return 422 for invalid JSON fields.
    """
    client = await spawn_client(authenticated=True)

    resp = await client.patch("/account/settings", data)

    assert resp.status == status
    assert await resp.json() == snapshot(name="response")


async def test_get_api_keys(
    fake: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    snapshot,
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
                UserUpdateRequest(groups=[group.id]),
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
            UserUpdateRequest(administrator=has_admin, groups=[group.id]),
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

        assert resp.status == 200
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
    error: str | None,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
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


async def test_logout(spawn_client: ClientSpawner):
    """Test that calling the logout endpoint results in the current session being removed and the user being logged
    out.

    """
    client = await spawn_client(authenticated=True)

    # Make sure the session is authorized
    resp = await client.get("/account")
    assert resp.status == 200

    # Logout
    resp = await client.get("/account/logout")
    assert resp.status == 200

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
async def test_requires_authorization(
    method: str,
    path: str,
    spawn_client: ClientSpawner,
):
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
    ("request_path", "correct_code"),
    [
        ("account/keys", True),
        ("account/reset", True),
        ("account/reset", False),
    ],
)
async def test_login_reset(
    request_path: str,
    correct_code: bool,
    data_layer: DataLayer,
    spawn_client: ClientSpawner,
    snapshot: SnapshotAssertion,
) -> None:
    client = await spawn_client(authenticated=False)

    await data_layer.users.create("foobar", "hello_world", True)

    resp = await client.post(
        "/account/login",
        {
            "username": "foobar",
            "handle": "foobar",
            "password": "hello_world",
            "force_reset": True,
        },
    )

    resp_data = await resp.json()

    assert "session_id=session" in resp.headers.get("Set-Cookie")
    assert resp_data.get("reset_code") is not None
    assert resp_data.get("reset") is True

    data = {
        "password": "invalid",
        "reset_code": resp_data.get("reset_code") if correct_code else "wrong_code",
    }

    resp = await client.post(request_path, data)
    assert await resp.json() == snapshot

    data["password"] = "hello_world"

    resp = await client.post(request_path, data)

    assert await resp.json() == snapshot
