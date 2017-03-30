import pytest

from virtool.users import check_password


class TestGetSettings:

    async def test_authorized(self, do_get):
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

    async def test_not_authorized(self, do_get):
        """
        Test that a ``GET /account/settings`` returns 404 for an unauthorized session.

        """
        resp = await do_get("/api/account/settings", authorize=False)

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Requires login"
        }


class TestUpdateSettings:

    async def test_authorized(self, do_put):
        """
        Test that account settings can be updated at ``POST /account/settings``.

        """
        resp = await do_put("/api/account/settings", {
            "show_ids": False
        }, authorize=True)

        assert resp.status == 200

        assert await resp.json() == {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        }

    async def test_not_authorized(self, do_put):
        """
        Test that requests to ``POST /account/settings`` return 400 for unauthorized sessions.

        """
        resp = await do_put("/api/account/settings", {
            "show_ids": False
        })

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Requires login"
        }

    async def test_unknown_field(self, do_put):
        """
        Test that requests to ``POST /account/settings`` return 422 for unknown JSON fields.

        """
        resp = await do_put("/api/account/settings", {
            "foo_bar": False
        }, authorize=True)

        assert resp.status == 422

    async def test_invalid_field(self, do_put):
        """
        Test that requests to ``POST /account/settings`` return 422 for invalid JSON fields.

        """
        resp = await do_put("/api/account/settings", {
            "show_ids": "False"
        }, authorize=True)

        assert resp.status == 422


class TestChangePassword:

    async def test_valid(self, test_db, do_put):
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

    async def test_invalid_credentials(self, do_put):
        """
        Test that request to ``PUT /account/password`` return 400 for wrong ``old_password`` values.
         
        """
        resp = await do_put("/api/account/password", {
            "old_password": "not_right",
            "new_password": "foo_bar"
        }, authorize=True)

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Invalid credentials"
        }

    async def test_not_authorized(self, do_put):
        """
        Test that requests to ``PUT /account/password`` return 400 for unauthorized sessions.

        """
        resp = await do_put("/api/account/password", {
            "old_password": "hello_world",
            "new_password": "foo_bar"
        }, authorize=False)

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Requires login"
        }

    async def test_missing_field(self, do_put):
        """
        Test that requests to ``PUT /account/password`` return 422 for missing fields.

        """
        resp = await do_put("/api/account/password", {
            "old_password": False
        }, authorize=True)

        assert resp.status == 422

    async def test_invalid_field(self, do_put):
        """
        Test that requests to ``PUT /account/password`` return 422 for invalid fields.

        """
        resp = await do_put("/api/account/password", {
            "old_password": "hello_world",
            "new_password": 1234
        }, authorize=True)

        assert resp.status == 422
