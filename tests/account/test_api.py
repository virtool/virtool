import pytest

import virtool.users.utils


async def test_get(spawn_client, static_time):
    client = await spawn_client(authorize=True)

    resp = await client.get("/api/account")

    assert resp.status == 200

    assert await resp.json() == {
        "groups": [],
        "id": "test",
        "administrator": False,
        "identicon": "identicon",
        "last_password_change": static_time.iso,
        "permissions": {p: False for p in virtool.users.utils.PERMISSIONS},
        "primary_group": "technician",
        "settings": {
            "quick_analyze_workflow": "pathoscope_bowtie",
            "show_ids": True,
            "show_versions": True,
            "skip_quick_analyze_dialog": True
        }
    }


@pytest.mark.parametrize("error", [
    None,
    "email_error",
    "password_length_error",
    "missing_old_password",
    "credentials_error"
])
async def test_edit(error, spawn_client, resp_is, static_time):
    client = await spawn_client(authorize=True)

    client.app["settings"]["minimum_password_length"] = 8

    data = {
        "email": "dev-at-virtool.ca" if error == "email_error" else "dev@virtool.ca",
        "password": "foo" if error == "password_length_error" else "foo_bar_1"
    }

    if error != "missing_old_password":
        data["old_password"] = "not_right" if error == "credentials_error" else "hello_world"

    resp = await client.patch("/api/account", data)

    if error == "email_error":
        await resp_is.invalid_input(resp, {"dev-at-virtool.ca": ["unknown field"]})

    elif error == "password_length_error":
        await resp_is.invalid_input(resp, {"dev-at-virtool.ca": ["unknown field"]})

    elif error == "missing_old_password":
        await resp_is.invalid_input(resp, {"password": ["field 'old_password' is required"]})

    elif error == "credentials_error":
        await resp_is.bad_request(resp, "Invalid credentials")

    else:
        assert resp.status == 200

        assert await resp.json() == {
            "permissions": {
                "cancel_job": False,
                "create_ref": False,
                "create_sample": False,
                "modify_hmm": False,
                "modify_subtraction": False,
                "remove_file": False,
                "remove_job": False,
                "upload_file": False
            },
            "groups": [],
            "identicon": "identicon",
            "administrator": False,
            "last_password_change": static_time.iso,
            "primary_group": "technician",
            "settings": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_workflow": "pathoscope_bowtie"
            },
            "email": "dev@virtool.ca",
            "id": "test"
        }


async def test_get_settings(spawn_client):
    """
    Test that a ``GET /account/settings`` returns the settings for the session user.

    """
    client = await spawn_client(authorize=True)

    resp = await client.get("/api/account/settings")

    assert resp.status == 200

    assert await resp.json() == {
        "skip_quick_analyze_dialog": True,
        "show_ids": True,
        "show_versions": True,
        "quick_analyze_workflow": "pathoscope_bowtie"
    }


@pytest.mark.parametrize("invalid_input", [False, True])
async def test_update_settings(invalid_input, spawn_client, resp_is):
    """
    Test that account settings can be updated at ``POST /account/settings`` and that requests to
    ``POST /account/settings`` return 422 for invalid JSON fields.

    """
    client = await spawn_client(authorize=True)

    data = {
        "show_ids": False
    }

    if invalid_input:
        data = {
            "foo_bar": True,
            "show_ids": "yes"
        }

    resp = await client.patch("/api/account/settings", data)

    if invalid_input:
        assert await resp_is.invalid_input(resp, {
            "show_ids": ["must be of boolean type"]
        })
    else:
        assert resp.status == 200

        assert await resp.json() == {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": True,
            "quick_analyze_workflow": "pathoscope_bowtie"
        }


async def test_get_api_keys(spawn_client):
    client = await spawn_client(authorize=True)

    await client.db.keys.insert_many([
        {
            "_id": "abc123",
            "id": "foobar_0",
            "name": "Foobar",
            "user": {
                "id": "test"
            }
        },
        {
            "_id": "xyz321",
            "id": "baz_1",
            "name": "Baz",
            "user": {
                "id": "test"
            }
        }
    ])

    resp = await client.get("/api/account/keys")

    assert await resp.json() == [
        {
            "id": "foobar_0",
            "name": "Foobar"
        },
        {
            "id": "baz_1",
            "name": "Baz"
        }
    ]


class TestCreateAPIKey:

    @pytest.mark.parametrize("has_perm", [True, False])
    @pytest.mark.parametrize("req_perm", [True, False])
    async def test(self, has_perm, req_perm, mocker, spawn_client, static_time, no_permissions):
        """
        Test that creation of an API key functions properly. Check that different permission inputs work.

        """
        mocker.patch("virtool.utils.generate_key", return_value=("raw_key", "hashed_key"))

        client = await spawn_client(authorize=True)

        if has_perm:
            await client.db.users.update_one({"_id": "test"}, {
                "$set": {
                    "permissions": {
                        **no_permissions,
                        "create_sample": True
                    }
                }
            })

        body = {
            "name": "Foobar"
        }

        if req_perm:
            body["permissions"] = {
                "create_sample": True
            }

        resp = await client.post("/api/account/keys", body)

        assert resp.status == 201

        expected = {
            "_id": "hashed_key",
            "id": "foobar_0",
            "name": "Foobar",
            "created_at": static_time.datetime,
            "user": {
                "id": "test"
            },
            "groups": [],
            "permissions": {**no_permissions, "create_sample": has_perm and req_perm}
        }

        assert await client.db.keys.find_one() == expected

        expected.update({
            "key": "raw_key",
            "created_at": static_time.iso
        })

        del expected["_id"]
        del expected["user"]

        assert await resp.json() == expected

    async def test_naming(self, mocker, spawn_client, static_time):
        """
        Test that uniqueness is ensured on the ``id`` field.

        """
        mocker.patch("virtool.utils.generate_key", return_value=("raw_key", "hashed_key"))

        client = await spawn_client(authorize=True)

        await client.db.keys.insert_one({
            "_id": "foobar",
            "id": "foobar_0",
            "name": "Foobar"
        })

        body = {
            "name": "Foobar"
        }

        resp = await client.post("/api/account/keys", body)

        assert resp.status == 201

        expected = {
            "_id": "hashed_key",
            "id": "foobar_1",
            "name": "Foobar",
            "created_at": static_time.datetime,
            "user": {
                "id": "test"
            },
            "groups": [],
            "permissions": {p: False for p in virtool.users.utils.PERMISSIONS}
        }

        assert await client.db.keys.find_one({"id": "foobar_1"}) == expected

        expected.update({
            "key": "raw_key",
            "created_at": static_time.iso
        })

        del expected["_id"]
        del expected["user"]

        assert await resp.json() == expected


class TestUpdateAPIKey:

    @pytest.mark.parametrize("has_admin", [True, False])
    @pytest.mark.parametrize("has_perm", [True, False])
    async def test(self, has_admin, has_perm, spawn_client, static_time):
        client = await spawn_client(authorize=True)

        await client.db.users.update_one({"_id": "test"}, {
            "$set": {
                "administrator": has_admin,
                "permissions.create_sample": True,
                "permissions.modify_subtraction": has_perm
            }
        })

        expected = {
            "_id": "foobar",
            "id": "foobar_0",
            "name": "Foobar",
            "created_at": static_time.datetime,
            "user": {
                "id": "test"
            },
            "groups": [],
            "permissions": {p: False for p in virtool.users.utils.PERMISSIONS}
        }

        await client.db.keys.insert_one(expected)

        resp = await client.patch("/api/account/keys/foobar_0", {
            "permissions": {
                "create_sample": True,
                "modify_subtraction": True
            }
        })

        assert resp.status == 200

        expected["permissions"].update({
            "create_sample": True,
            "modify_subtraction": has_admin or has_perm
        })

        assert await client.db.keys.find_one() == expected

        del expected["_id"]
        del expected["user"]

        expected["created_at"] = static_time.iso

        assert await resp.json() == expected

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.patch("/api/account/keys/foobar_0", {
            "permissions": {
                "create_sample": True
            }
        })

        assert await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, "404"])
async def test_remove_api_key(error, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.keys.insert_one({
            "_id": "foobar",
            "id": "foobar_0",
            "name": "Foobar",
            "user": {
                "id": "test"
            }
        })

    resp = await client.delete("/api/account/keys/foobar_0")

    if error:
        await resp_is.not_found(resp)
        return

    await resp_is.no_content(resp)
    assert await client.db.keys.count_documents({}) == 0


async def test_remove_all_api_keys(spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    await client.db.keys.insert_many([
        {
            "_id": "hello_world",
            "id": "hello_world_0",
            "user": {
                "id": "test"
            }
        },
        {
            "_id": "foobar",
            "id": "foobar_0",
            "user": {
                "id": "test"
            }
        },
        {
            "_id": "baz",
            "id": "baz_0",
            "user": {
                "id": "fred"
            }
        }
    ])

    resp = await client.delete("/api/account/keys")

    await resp_is.no_content(resp)

    assert await client.db.keys.find().to_list(None) == [{
        "_id": "baz",
        "id": "baz_0",
        "user": {
            "id": "fred"
        }
    }]


async def test_logout(spawn_client):
    """
    Test that calling the logout endpoint results in the current session being removed and the user being logged
    out.

    """
    client = await spawn_client(authorize=True)

    # Make sure the session is authorized
    resp = await client.get("/api/account")
    assert resp.status == 200

    # Logout
    resp = await client.get("/api/account/logout")
    assert resp.status == 200

    # Make sure that the session is no longer authorized
    resp = await client.get("/api/account")
    assert resp.status == 401


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/account"),
    ("PATCH", "/api/account"),
    ("GET", "/api/account/settings"),
    ("PATCH", "/api/account/settings"),
    ("PATCH", "/api/account/settings"),
    ("GET", "/api/account/keys"),
    ("POST", "/api/account/keys"),
    ("PATCH", "/api/account/keys/foobar"),
    ("DELETE", "/api/account/keys/foobar"),
    ("DELETE", "/api/account/keys")
])
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
        "message": "Requires authorization"
    }

    assert resp.status == 401
