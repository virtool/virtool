import datetime

from virtool.users import check_password
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
                "last_password_change": "2017-10-06T20:00:00+00:00",
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
            "last_password_change": "2017-10-06T20:00:00+00:00",
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

    async def test_valid(self, monkeypatch, static_time, do_post, test_db):
        """
        Test that a valid request results in a user document being properly inserted.
        
        - check response        
        - check database        
        - check password
         
        """
        data = {
            "user_id": "bob",
            "password": "hello_world",
            "force_reset": False
        }

        monkeypatch.setattr("virtool.utils.timestamp", lambda: static_time)

        resp = await do_post("/api/users", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        expected = {
            "user_id": "bob",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2017-10-06T20:00:00+00:00",
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

        assert await resp.json() == expected

        expected.update({
            "_id": expected.pop("user_id"),
            "last_password_change": datetime.datetime(2017, 10, 6, 20, 0)
        })

        assert test_db.users.find_one("bob", list(expected.keys())) == expected

        document = test_db.users.find_one("bob", ["password"])

        assert check_password("hello_world", document["password"])

    async def test_invalid_input(self, do_post):
        """
        Test that invalid and missing input data result in a ``422`` response with detailed error data.
         
        """
        data = {
            "username": "bob",
            "password": 1234,
            "force_reset": False
        }

        resp = await do_post("/api/users", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 422

        assert await resp.json() == {
            "message": "Invalid input",
            "errors": {
                "username": ["unknown field"],
                "password": ["must be of string type"],
                "user_id": ["required field"]
            }
        }

    async def test_user_exists(self, do_post):
        """
        Test that an input ``user_id`` that already exists results in a ``400`` response with informative error message.

        """
        data = {
            "user_id": "test",
            "password": "hello_world",
            "force_reset": False
        }

        resp = await do_post("/api/users", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "User already exists"
        }


class TestSetPassword(ProtectedTest):

    async def test_valid(self, monkeypatch, do_put, test_db, static_time, create_user):
        """
        Test that a valid request results in a password change.

        """
        bob = create_user("bob")

        bob["last_password_change"] = None

        test_db.users.insert(bob)

        data = {
            "password": "foo_bar",
            "force_reset": False
        }

        monkeypatch.setattr("virtool.utils.timestamp", lambda: static_time)

        resp = await do_put("/api/users/bob/password", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        print(test_db.users.find_one("bob"))

        assert await resp.json() == {
            "last_password_change": static_time.isoformat(),
            "force_reset": False,
            "user_id": "bob"
        }
