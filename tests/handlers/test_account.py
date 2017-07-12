import pytest
from virtool.user import check_password


class TestGet:

    async def test(self, do_get):
        resp = await do_get("/api/account", authorize=True)

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": False,
            "groups": [],
            "id": "test",
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "add_host": False,
                "add_sample": False,
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

    async def test(self, do_get):
        """
        Test that a ``GET /account/settings`` returns the settings for the session user.

        """
        resp = await do_get("/api/account/settings", authorize=True)

        assert resp.status == 200

        assert await resp.json() == {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        }


class TestUpdateSettings:

    async def test(self, do_patch):
        """
        Test that account settings can be updated at ``POST /account/settings``.

        """
        resp = await do_patch("/api/account/settings", {
            "show_ids": False
        }, authorize=True)

        assert resp.status == 200

        assert await resp.json() == {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        }

    async def test_invalid_input(self, do_patch, resp_is):
        """
        Test that requests to ``POST /account/settings`` return 422 for invalid JSON fields.

        """
        resp = await do_patch("/api/account/settings", {
            "show_ids": "yes",
            "foo_bar": True
        }, authorize=True)

        assert await resp_is.invalid_input(resp,  {
            "show_ids": ["must be of boolean type"],
            "foo_bar": ["unknown field"]
        })


class TestChangePassword:

    async def test(self, test_db, do_put):
        """
        Test that requests to ``PUT /account/password`` return 400 for unauthorized sessions.

        """
        resp = await do_put("/api/account/password", {
            "old_password": "hello_world",
            "new_password": "foo_bar"
        }, authorize=True)

        assert resp.status == 200

        document = test_db.users.find_one({"_id": "test"}, ["password"])

        assert check_password("foo_bar", document["password"])

    async def test_invalid_credentials(self, do_put, resp_is):
        """
        Test that request to ``PUT /account/password`` return 400 for wrong ``old_password`` values.
         
        """
        resp = await do_put("/api/account/password", {
            "old_password": "not_right",
            "new_password": "foo_bar"
        }, authorize=True)

        assert await resp_is.bad_request(resp, "Invalid credentials")

    async def test_invalid_input(self, do_put, resp_is):
        """
        Test that requests to ``PUT /account/password`` return 422 for invalid fields.

        """
        resp = await do_put("/api/account/password", {
            "new_password": 1234
        }, authorize=True)

        assert await resp_is.invalid_input(resp, {
            "old_password": ["required field"],
            "new_password": ["must be of string type"]
        })


class TestLogout:

    async def test(self, do_get):
        """
        Test that calling the logout endpoint results in the current session being removed and the user being logged
        out.

        """
        # Authorize the session
        resp = await do_get("/api/account", authorize=True)
        assert resp.status == 200

        # Make sure the session is still authorized
        resp = await do_get("/api/account")
        assert resp.status == 200

        # Logout
        resp = await do_get("/api/account/logout")
        assert resp.status == 204

        # Make sure that the session is no longer authorized
        resp = await do_get("/api/account")
        assert resp.status == 401


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/account"),
    ("GET", "/api/account/settings"),
    ("PATCH", "/api/account/settings"),
    ("PUT", "/api/account/password"),
])
async def test_requires_authorization(method, path, do_get, do_patch, do_put):
    """
    Test that a requires authorization 401 response is sent when the session is not authenticated.

    """
    if method == "GET":
        resp = await do_get(path)
    elif method == "PATCH":
        resp = await do_patch(path, {})
    else:
        resp = await do_put(path, {})

    assert await resp.json() == {
        "id": "requires_authorization",
        "message": "Requires authorization"
    }

    assert resp.status == 401
