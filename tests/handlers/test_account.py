import pytest

from virtool.user import check_password
from virtool.user_permissions import PERMISSIONS


async def test_get(spawn_client):
    client = await spawn_client(authorize=True)

    resp = await client.get("/api/account")

    assert resp.status == 200

    assert await resp.json() == {
        "groups": [],
        "id": "test",
        "last_password_change": "2015-10-06T20:00:00Z",
        "permissions": {p: False for p in PERMISSIONS},
        "primary_group": "technician",
        "settings": {
            "quick_analyze_algorithm": "pathoscope_bowtie",
            "show_ids": True,
            "show_versions": True,
            "skip_quick_analyze_dialog": True
        }
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
        "quick_analyze_algorithm": "pathoscope_bowtie"
    }


class TestUpdateSettings:

    async def test(self, spawn_client):
        """
        Test that account settings can be updated at ``POST /account/settings``.

        """
        client = await spawn_client(authorize=True)

        resp = await client.patch("/api/account/settings", {
            "show_ids": False
        })

        assert resp.status == 200

        assert await resp.json() == {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        }

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that requests to ``POST /account/settings`` return 422 for invalid JSON fields.

        """
        client = await spawn_client(authorize=True)

        resp = await client.patch("/api/account/settings", {
            "show_ids": "yes",
            "foo_bar": True
        })

        assert await resp_is.invalid_input(resp,  {
            "show_ids": ["must be of boolean type"],
            "foo_bar": ["unknown field"]
        })


class TestChangePassword:

    async def test(self, spawn_client):
        """
        Test that requests to ``PUT /account/password`` return 400 for unauthorized sessions.

        """
        client = await spawn_client(authorize=True)

        resp = await client.put("/api/account/password", {"old_password": "hello_world", "new_password": "foo_bar_1"})

        assert resp.status == 200

        document = await client.db.users.find_one({"_id": "test"}, ["password"])

        assert check_password("foo_bar_1", document["password"])

    async def test_too_short(self, spawn_client, resp_is):
        """
        Test that request to ``PUT /account/password`` return 400 for wrong ``old_password`` values.

        """
        client = await spawn_client(authorize=True)

        resp = await client.put("/api/account/password", {
            "old_password": "not_right",
            "new_password": "foo_bar"
        })

        assert await resp_is.bad_request(resp, "Password is to short. Must be at least 8 characters.")

    async def test_invalid_old(self, spawn_client, resp_is):
        """
        Test that request to ``PUT /account/password`` return 400 for wrong ``old_password`` values.

        """
        client = await spawn_client(authorize=True)

        resp = await client.put("/api/account/password", {
            "old_password": "not_right",
            "new_password": "foo_bar_1"
        })

        assert await resp_is.bad_request(resp, "Invalid old password.")

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that requests to ``PUT /account/password`` return 422 for invalid fields.

        """
        client = await spawn_client(authorize=True)

        resp = await client.put("/api/account/password", {"new_password": 1234})

        assert await resp_is.invalid_input(resp, {
            "old_password": ["required field"],
            "new_password": ["must be of string type"]
        })


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

    @pytest.mark.parametrize("req_permissions", [
        None,
        {
            "create_sample": True
        },
        {
            "modify_subtraction": True,
            "rebuild_index": True
        },
        {
            "cancel_job": True,
            "create_sample": True,
            "manage_users": True,
            "modify_hmm": True,
            "modify_settings": True,
            "modify_virus": True,
            "rebuild_index": True,
            "remove_job": True,
            "remove_virus": True
        }
    ])
    async def test(self, req_permissions, mocker, spawn_client, static_time, test_motor):
        """
        Test that creation of an API key functions properly. Check that different permission inputs work.

        """
        mocker.patch("virtool.user.get_api_key", return_value="abc123xyz789")

        client = await spawn_client(authorize=True)

        body = {
            "name": "Foobar"
        }

        if req_permissions:
            body["permissions"] = req_permissions

        resp = await client.post("/api/account/keys", body)

        print(await resp.json())

        assert resp.status == 201

        expected = {
            "_id": "57f614878f6056613d77f38b8b105bed8bb452f49a98c70cc63099a5129bac80",
            "id": "foobar_0",
            "name": "Foobar",
            "created_at": static_time,
            "user": {
                "id": "test"
            },
            "groups": [],
            "permissions": {p: False for p in PERMISSIONS}
        }

        if req_permissions:
            expected["permissions"].update(req_permissions)

        assert await test_motor.keys.find_one() == expected

        expected.update({
            "key": "abc123xyz789",
            "created_at": "2017-10-06T20:00:00Z"
        })

        del expected["_id"]
        del expected["user"]

        assert await resp.json() == expected

    async def test_naming(self, mocker, spawn_client, static_time):
        """
        Test that uniqueness is ensured on the ``id`` field.

        """
        mocker.patch("virtool.user.get_api_key", return_value="987zyx321cba")

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
            "_id": "b85815a74c3c42fe4a0aa79069defc59f93a8b344d509fdae87cfaa795a2fd68",
            "id": "foobar_1",
            "name": "Foobar",
            "created_at": static_time,
            "user": {
                "id": "test"
            },
            "groups": [],
            "permissions": {p: False for p in PERMISSIONS}
        }

        assert await client.db.keys.find_one({"id": "foobar_1"}) == expected

        expected.update({
            "key": "987zyx321cba",
            "created_at": "2017-10-06T20:00:00Z"
        })

        del expected["_id"]
        del expected["user"]

        assert await resp.json() == expected


class TestUpdateAPIKey:

    async def test(self, spawn_client, static_time):
        client = await spawn_client(authorize=True)

        expected = {
            "_id": "foobar",
            "id": "foobar_0",
            "name": "Foobar",
            "created_at": static_time,
            "user": {
                "id": "test"
            },
            "groups": [],
            "permissions": {
                "cancel_job": False,
                "create_sample": False,
                "manage_users": False,
                "modify_hmm": False,
                "modify_host": False,
                "modify_options": False,
                "modify_virus": False,
                "rebuild_index": False,
                "remove_host": False,
                "remove_job": False,
                "remove_virus": False
            }
        }

        await client.db.keys.insert_one(expected)

        resp = await client.patch("/api/account/keys/foobar_0", {
            "permissions": {"manage_users": True}
        })

        assert resp.status == 200

        expected["permissions"]["manage_users"] = True

        assert await client.db.keys.find_one() == expected

        del expected["_id"]
        del expected["user"]

        expected["created_at"] = "2017-10-06T20:00:00Z"

        assert await resp.json() == expected

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.patch("/api/account/keys/foobar_0", {})

        assert await resp_is.not_found(resp)


class TestRemoveAPIKey:

    async def test(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        await client.db.keys.insert_one({
            "_id": "foobar",
            "id": "foobar_0",
            "name": "Foobar",
            "user": {
                "id": "test"
            }
        })

        resp = await client.delete("/api/account/keys/foobar_0")

        assert await resp_is.no_content(resp)

        assert await client.db.keys.count() == 0

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that ``404 Not found`` is returned when the API key does not exist.

        """
        client = await spawn_client(authorize=True)

        resp = await client.delete("/api/account/keys/foobar_0")

        assert await resp_is.not_found(resp)


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

    assert await resp_is.no_content(resp)

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
    assert resp.status == 204

    # Make sure that the session is no longer authorized
    resp = await client.get("/api/account")
    assert resp.status == 401


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/account"),
    ("GET", "/api/account/settings"),
    ("PATCH", "/api/account/settings"),
    ("PUT", "/api/account/password"),
])
async def test_requires_authorization(method, path, spawn_client):
    """
    Test that a requires authorization 401 response is sent when the session is not authenticated.

    """
    client = await spawn_client()

    if method == "GET":
        resp = await client.get(path)
    elif method == "PATCH":
        resp = await client.patch(path, {})
    else:
        resp = await client.put(path, {})

    assert await resp.json() == {
        "id": "requires_authorization",
        "message": "Requires authorization"
    }

    assert resp.status == 401
