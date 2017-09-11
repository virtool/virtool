import pytest
from virtool.user import check_password


class TestGet:

    async def test(self, spawn_client):
        client = await spawn_client(authorize=True)

        resp = await client.get("/api/account")

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": False,
            "groups": [],
            "id": "test",
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "modify_host": False,
                "create_sample": False,
                "add_virus": False,
                "archive_job": False,
                "cancel_job": False,
                "manage_users": False,
                "modify_hmm": False,
                "modify_options": False,
                "modify_virus": False,
                "rebuild_index": False,
                "remove_host": False,
                "remove_job": False,
                "remove_virus": False
            },
            "primary_group": "",
            "settings": {
                "quick_analyze_algorithm": "pathoscope_bowtie",
                "show_ids": True,
                "show_versions": True,
                "skip_quick_analyze_dialog": True
            }
        }


class TestGetSettings:

    async def test(self, spawn_client):
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

        resp = await client.put("/api/account/password", {"old_password": "hello_world", "new_password": "foo_bar"})

        assert resp.status == 200

        document = await client.db.users.find_one({"_id": "test"}, ["password"])

        assert check_password("foo_bar", document["password"])

    async def test_invalid_credentials(self, spawn_client, resp_is):
        """
        Test that request to ``PUT /account/password`` return 400 for wrong ``old_password`` values.

        """
        client = await spawn_client(authorize=True)

        resp = await client.put("/api/account/password", {
            "old_password": "not_right",
            "new_password": "foo_bar"
        })

        assert await resp_is.bad_request(resp, "Invalid credentials")

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


class TestLogout:

    async def test(self, spawn_client):
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
