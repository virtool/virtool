import pytest

from virtool.data.utils import get_data_from_app
from virtool.settings.oas import UpdateSettingsSchema
from virtool.users.utils import Permission, hash_password


async def test_get(snapshot, spawn_client, static_time):
    client = await spawn_client(authorize=True)

    resp = await client.get("/account")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize(
    "body,status",
    [
        (
            {
                "email": "dev@virtool.ca",
                "password": "foo_bar_1",
                "old_password": "hello_world",
            },
            200,
        ),
        ({"email": "dev@virtool.ca"}, 200),
        ({"email": "invalid_email@"}, 400),
        ({"password": "foo", "old_password": "hello_world"}, 400),
        ({"password": "foo_bar_1"}, 400),
        ({"password": "foo_bar_1", "old_password": "not_right"}, 400),
        ({"old_password": "hello_world"}, 400),
        ({"password": "foo_bar_1", "old_password": "hello_world"}, 200),
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
async def test_edit(body, status, snapshot, spawn_client, resp_is, static_time):
    client = await spawn_client(authorize=True)

    await get_data_from_app(client.app).settings.update(
        UpdateSettingsSchema(minimum_password_length=8)
    )

    resp = await client.patch("/account", body)

    assert resp.status == status
    assert await resp.json() == snapshot(name="response")


async def test_get_settings(spawn_client):
    """
    Test that a ``GET /account/settings`` returns the settings for the session user.

    """
    client = await spawn_client(authorize=True)

    resp = await client.get("/account/settings")

    assert resp.status == 200

    assert await resp.json() == {
        "skip_quick_analyze_dialog": True,
        "show_ids": True,
        "show_versions": True,
        "quick_analyze_workflow": "pathoscope_bowtie",
    }


@pytest.mark.parametrize(
    "data,status",
    [
        (
            {"show_ids": False},
            200,
        ),
        ({"foo_bar": True, "show_ids": "foo"}, 400),
        (
            {
                "show_ids": None,
                "show_versions": None,
                "skip_quick_analyze_dialog": None,
                "quick_analyze_workflow": None,
            },
            400,
        ),
    ],
    ids=["valid_input", "invalid_input", "null_values"],
)
async def test_update_settings(data, status, spawn_client, resp_is, snapshot):
    """
    Test that account settings can be updated at ``POST /account/settings`` and that requests to
    ``POST /account/settings`` return 422 for invalid JSON fields.

    """
    client = await spawn_client(authorize=True)

    resp = await client.patch("/account/settings", data)

    assert resp.status == status
    assert await resp.json() == snapshot(name="response")


async def test_get_api_keys(spawn_client, static_time):
    client = await spawn_client(authorize=True)

    await client.db.keys.insert_many(
        [
            {
                "_id": "abc123",
                "id": "foobar_0",
                "name": "Foobar",
                "user": {"id": "test"},
                "created_at": static_time.datetime,
                "administrator": True,
                "groups": [],
                "permissions": {},
            },
            {
                "_id": "xyz321",
                "id": "baz_1",
                "name": "Baz",
                "user": {"id": "test"},
                "created_at": static_time.datetime,
                "administrator": False,
                "groups": [],
                "permissions": {},
            },
        ]
    )

    resp = await client.get("/account/keys")

    assert await resp.json() == [
        {
            "administrator": True,
            "created_at": "2015-10-06T20:00:00Z",
            "groups": [],
            "id": "foobar_0",
            "name": "Foobar",
            "permissions": {
                "cancel_job": False,
                "create_ref": False,
                "create_sample": False,
                "modify_hmm": False,
                "modify_subtraction": False,
                "remove_file": False,
                "remove_job": False,
                "upload_file": False,
            },
        },
        {
            "administrator": False,
            "created_at": "2015-10-06T20:00:00Z",
            "groups": [],
            "id": "baz_1",
            "name": "Baz",
            "permissions": {
                "cancel_job": False,
                "create_ref": False,
                "create_sample": False,
                "modify_hmm": False,
                "modify_subtraction": False,
                "remove_file": False,
                "remove_job": False,
                "upload_file": False,
            },
        },
    ]


class TestCreateAPIKey:
    @pytest.mark.parametrize("has_perm", [True, False])
    @pytest.mark.parametrize("req_perm", [True, False])
    async def test(
        self,
        has_perm,
        req_perm,
        mocker,
        snapshot,
        spawn_client,
        static_time,
        no_permissions,
    ):
        """
        Test that creation of an API key functions properly. Check that different permission inputs work.

        """
        mocker.patch(
            "virtool.utils.generate_key", return_value=("raw_key", "hashed_key")
        )

        client = await spawn_client(authorize=True)

        if has_perm:
            await client.db.users.update_one(
                {"_id": "test"},
                {
                    "$set": {
                        "permissions": {
                            **no_permissions,
                            Permission.create_sample.value: True,
                        }
                    }
                },
            )

        body = {"name": "Foobar"}

        if req_perm:
            body["permissions"] = {Permission.create_sample.value: True}

        resp = await client.post("/account/keys", body)

        assert resp.status == 201
        assert await resp.json() == snapshot
        assert await client.db.keys.find_one() == snapshot

    async def test_naming(self, mocker, snapshot, spawn_client, static_time):
        """
        Test that uniqueness is ensured on the ``id`` field.

        """
        mocker.patch(
            "virtool.utils.generate_key", return_value=("raw_key", "hashed_key")
        )

        client = await spawn_client(authorize=True)

        await client.db.keys.insert_one(
            {"_id": "foobar", "id": "foobar_0", "name": "Foobar"}
        )

        body = {"name": "Foobar"}

        resp = await client.post("/account/keys", body)

        assert resp.status == 201
        assert await resp.json() == snapshot
        assert await client.db.keys.find_one({"id": "foobar_1"}) == snapshot


class TestUpdateAPIKey:
    @pytest.mark.parametrize("has_admin", [True, False])
    @pytest.mark.parametrize("has_perm", [True, False, "missing"])
    async def test(self, has_admin, has_perm, snapshot, spawn_client, static_time):
        client = await spawn_client(authorize=True)

        await client.db.users.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "administrator": has_admin,
                    "permissions.create_sample": True,
                    "permissions.modify_subtraction": has_perm,
                }
            },
        )

        await client.db.keys.insert_one(
            {
                "_id": "foobar",
                "id": "foobar_0",
                "name": "Foobar",
                "created_at": static_time.datetime,
                "administrator": True,
                "user": {"id": "test"},
                "groups": [],
                "permissions": {p.value: False for p in Permission},
            }
        )

        data = {
            "permissions": {
                Permission.create_sample.value: True,
                Permission.modify_subtraction.value: True,
            }
        }

        if has_perm == "missing":
            data = {}

        resp = await client.patch(
            "/account/keys/foobar_0",
            data,
        )

        assert resp.status == 200
        assert await resp.json() == snapshot
        assert await client.db.keys.find_one() == snapshot

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.patch(
            "/account/keys/foobar_0",
            {"permissions": {Permission.create_sample.value: True}},
        )

        await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, "404"])
async def test_remove_api_key(error, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.keys.insert_one(
            {
                "_id": "foobar",
                "id": "foobar_0",
                "name": "Foobar",
                "user": {"id": "test"},
            }
        )

    resp = await client.delete("/account/keys/foobar_0")

    if error:
        await resp_is.not_found(resp)
        return

    await resp_is.no_content(resp)
    assert await client.db.keys.count_documents({}) == 0


async def test_remove_all_api_keys(spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    await client.db.keys.insert_many(
        [
            {"_id": "hello_world", "id": "hello_world_0", "user": {"id": "test"}},
            {"_id": "foobar", "id": "foobar_0", "user": {"id": "test"}},
            {"_id": "baz", "id": "baz_0", "user": {"id": "fred"}},
        ]
    )

    resp = await client.delete("/account/keys")

    await resp_is.no_content(resp)

    assert await client.db.keys.find().to_list(None) == [
        {"_id": "baz", "id": "baz_0", "user": {"id": "fred"}}
    ]


async def test_logout(spawn_client):
    """
    Test that calling the logout endpoint results in the current session being removed and the user being logged
    out.

    """
    client = await spawn_client(authorize=True)

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
async def test_requires_authorization(method, path, spawn_client):
    """
    Test that a requires authorization 401 response is sent when the session is not authenticated.

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
    """
    Tests that when an invalid permission is used, validators.is_permission_dict raises a 422 error.
    """
    client = await spawn_client(authorize=True)

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
    """
    Tests that when an invalid email is used, validators.is_valid_email raises a 422 error.
    """
    client = await spawn_client(authorize=True)

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
            }
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
    ids=["all_valid", "wrong_handle", "wrong_password", "missing_remember", "remember_is_none"],
)
async def test_login(
    spawn_client, create_user, resp_is, body, status, mocker, snapshot
):
    client = await spawn_client()

    await client.db.users.insert_one(
        {
            "user_id": "abc123",
            "handle": "foobar",
            "password": hash_password("p@ssword123"),
        }
    )

    mocker.patch(
        "virtool.users.sessions.replace_session",
        return_value=[None, {"_id": None}, None],
    )

    resp = await client.post("/account/login", body)

    assert resp.status == status
    assert await resp.json() == snapshot
