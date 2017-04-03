from datetime import datetime
from freezegun import freeze_time
from virtool.tests.cls import ProtectedTest


class TestFind(ProtectedTest):

    async def test_valid(self, do_get, test_db, create_user):
        """
        Test that a ``GET /users`` returns a list of users.

        """
        user_ids = ["bob", "fred", "john"]

        for user_id in user_ids:
            test_db.users.insert(create_user(user_id))

        resp = await do_get("/api/users", authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        data = await resp.json()

        for i, user_id in enumerate(user_ids):
            assert data[i] == {
                "user_id": user_id,
                "force_reset": False,
                "groups": [],
                "last_password_change": "2017-10-06T13:00:00.000000",
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


class TestGet(ProtectedTest):

    async def test_exists(self, do_get, test_db, create_user):
        """
        Test that a ``GET /api/users`` returns a list of users.

        """
        user_ids = ["bob", "fred"]

        for user_id in user_ids:
            test_db.users.insert(create_user(user_id))

        resp = await do_get("/api/users/fred", authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        assert await resp.json() == {
            "user_id": "fred",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2017-10-06T13:00:00.000000",
            "permissions": {
                "add_host": False,
                "add_sample": False,
                "add_virus": False,
                "archive_job": False,
                "cancel_job": False,
                "modify_hmm": False,
                "manage_users": False,
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

    async def test_does_not_exist(self, do_get):
        """
        Test that a ``GET /api/users/:user_id`` for a non-existent ``user_id`` results in a ``404`` response.
        
        """
        resp = await do_get("/api/users/fred", authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestCreate(ProtectedTest):

    async def test_valid(self, monkeypatch, do_post, test_db):
        data = {
            "user_id": "bob",
            "password": "hello_world",
            "force_reset": False
        }

        resp = await do_post("/api/users", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        assert await resp.json() == {
            "user_id": "bob",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2017-10-06T13:00:00.000000",
            "permissions": {
                "add_host": False,
                "add_sample": False,
                "add_virus": False,
                "archive_job": False,
                "cancel_job": False,
                "modify_hmm": False,
                "manage_users": False,
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

        assert test_db.users.find_one("bob") == {
            "_id": "bob",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2017-10-06T13:00:00.000000",
            "permissions": {
                "add_host": False,
                "add_sample": False,
                "add_virus": False,
                "archive_job": False,
                "cancel_job": False,
                "modify_hmm": False,
                "manage_users": False,
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


