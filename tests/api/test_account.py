from virtool.user import check_password


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

    async def test_invalid_input(self, do_patch):
        """
        Test that requests to ``POST /account/settings`` return 422 for invalid JSON fields.

        """
        resp = await do_patch("/api/account/settings", {
            "show_ids": "yes",
            "foo_bar": True
        }, authorize=True)

        assert resp.status == 422

        assert await resp.json() == {
            "message": "Invalid input",
            "errors": {
                "show_ids": ["must be of boolean type"],
                "foo_bar": ["unknown field"]
            }
        }


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

    async def test_invalid_input(self, do_put):
        """
        Test that requests to ``PUT /account/password`` return 422 for invalid fields.

        """
        resp = await do_put("/api/account/password", {
            "new_password": 1234
        }, authorize=True)

        assert resp.status == 422

        assert await resp.json() == {
            "message": "Invalid input",
            "errors": {
                "old_password": ["required field"],
                "new_password": ["must be of string type"]
            }
        }
