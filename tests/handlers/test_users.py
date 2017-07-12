import datetime

from virtool.user import check_password


class TestFind:

    async def test_valid(self, do_get, test_db, create_user):
        """
        Test that a ``GET /users`` returns a list of users.

        """
        user_ids = ["bob", "fred", "john"]

        for user_id in user_ids:
            test_db.users.insert(create_user(user_id))

        resp = await do_get("/api/users", authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        base_dict = {
            "force_reset": False,
            "groups": [],
            "last_password_change": "2015-10-06T20:00:00Z",
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
            "primary_group": ""
        }

        expected = [dict(base_dict, id=user_id) for user_id in user_ids + ["test"]]

        expected[3]["permissions"] = dict(base_dict["permissions"], manage_users=True)

        assert await resp.json() == expected


class TestGet:

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
            "id": "fred",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2015-10-06T20:00:00Z",
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
            "primary_group": ""
        }

    async def test_does_not_exist(self, do_get):
        """
        Test that a ``GET /api/users/:user_id`` for a non-existent ``user_id`` results in a ``404`` response.
        
        """
        resp = await do_get("/api/users/fred", authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found"
        }


class TestCreate:

    async def test(self, monkeypatch, static_time, do_post, test_db):
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
            "id": "bob",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2017-10-06T20:00:00Z",
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
            "primary_group": ""
        }

        assert await resp.json() == expected

        expected.update({
            "_id": expected.pop("id"),
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
            "id": "invalid_input",
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


class TestSetPassword:

    async def test_valid(self, monkeypatch, do_put, test_db, static_time, create_user):
        """
        Test that a valid request results in a password change.

        """
        bob = create_user("bob")

        bob["last_password_change"] = None

        test_db.users.insert(bob)

        data = {
            "password": "foo_bar"
        }

        monkeypatch.setattr("virtool.utils.timestamp", lambda: static_time)

        resp = await do_put("/api/users/bob/password", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": False,
            "groups": [],
            "id": "bob",
            "last_password_change": "2017-10-06T20:00:00Z",
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
            "primary_group": ""
        }

    async def test_does_not_exist(self, do_put):
        """
        Test that a ``404`` response results when the ``user_id`` does not exist.
        
        """
        data = {
            "password": "foo_bar"
        }

        resp = await do_put("/api/users/fred/password", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found"
        }

    async def test_invalid_input(self, do_put):
        """
        Test that a valid request results in a password change.

        """
        resp = await do_put("/api/users/test/password", {"reset": False}, authorize=True, permissions=["manage_users"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "password": ["required field"],
                "reset": ["unknown field"]
            }
        }


class TestSetForceReset:

    async def test(self, do_put, test_db, create_user):
        """
        Test that a valid request results in a password change.

        """
        test_db.users.insert(create_user("bob"))

        data = {
            "force_reset": True
        }

        resp = await do_put("/api/users/bob/reset", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        import pprint
        pprint.pprint(await resp.json())

        assert await resp.json() == {
            "force_reset": True,
            "groups": [],
            "id": "bob",
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
            "primary_group": ""
        }

    async def test_invalid_input(self, do_put, test_db, create_user):
        """
        Test that a valid request results in a change to the ``force_reset`` field.

        """
        test_db.users.insert(create_user("bob"))

        data = {
            "unwanted": True,
            "force_reset": "False"
        }

        resp = await do_put("/api/users/bob/reset", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "unwanted": ["unknown field"],
                "force_reset": ["must be of boolean type"]
            }
        }

    async def test_does_not_exist(self, do_put):
        """
        Test that a ``404`` response results when the ``user_id`` does not exist.

        """
        data = {
            "force_reset": False
        }

        resp = await do_put("/api/users/fred/reset", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "User does not exist"
        }


class TestAddGroup:

    async def test_valid(self, test_db, do_post, create_user, no_permissions):
        """
        Test that a valid request results in the addition of a group to a user document.
         
        """
        test_db.groups.insert_many([
            {
                "_id": "tech",
                "permissions": dict(no_permissions, modify_virus=True)
            },
            {
                "_id": "test",
                "permissions": dict(no_permissions, rebuild_index=True)
            }
        ])

        test_db.users.insert(create_user("bob"))

        data = {
            "group_id": "tech"
        }

        resp = await do_post("/api/users/bob/groups", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        assert await resp.json() == {
            "user_id": "bob",
            "groups": ["tech"],
            "permissions": dict(no_permissions, modify_virus=True)
        }

    async def test_user_does_not_exist(self, test_db, do_post, no_permissions):
        """
        Test that a request to remove a group from a non-existent user results in a ``404`` response.
         
        """
        test_db.groups.insert_one({
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        })

        data = {
            "group_id": "tech"
        }

        resp = await do_post("/api/users/bob/groups", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "User does not exist"
        }

    async def test_group_does_not_exist(self, test_db, do_post, create_user):
        """
        Test that a request to delete an non-existent group results in a ``404`` response.
         
        """
        test_db.users.insert(create_user("bob"))

        data = {
            "group_id": "unknown"
        }

        resp = await do_post("/api/users/bob/groups", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "Group does not exist"
        }

    async def test_invalid_input(self, do_post):
        """
        Test that problems in the request input result in a ``422`` response with the appropriate error data attached. 

        """
        data = {
            "group": "tech"
        }

        resp = await do_post("/api/users/bob/groups", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "group": ["unknown field"],
                "group_id": ["required field"]
            }
        }


class TestRemoveGroup:

    async def test_valid(self, test_db, do_delete, create_user, no_permissions):
        """
        Test that a valid request can result in removal of a group from a user and recalculation of the user's
        permissions.
        
        """
        test_db.groups.insert_many([
            {
                "_id": "tech",
                "permissions": dict(no_permissions, modify_virus=True)
            },
            {
                "_id": "test",
                "permissions": dict(no_permissions, rebuild_index=True)
            }
        ])

        test_db.users.insert(create_user(
            "bob",
            groups=["tech", "test"],
            permissions=["modify_virus", "rebuild_index"]
        ))

        assert test_db.users.find_one("bob", ["_id", "groups", "permissions"]) == {
            "_id": "bob",
            "groups": ["tech", "test"],
            "permissions": dict(no_permissions, modify_virus=True, rebuild_index=True)
        }

        resp = await do_delete("/api/users/bob/groups/tech", authorize=True, permissions=["manage_users"])

        assert resp.status == 200

        assert await resp.json() == {
            "user_id": "bob",
            "groups": ["test"],
            "permissions": dict(no_permissions, rebuild_index=True)
        }

    async def test_user_does_not_exist(self, test_db, do_post, no_permissions):
        """
        Test that a ``404`` response results if the ``user_id`` does not exist.
        
        """
        test_db.groups.insert_one({
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        })

        data = {
            "group_id": "tech"
        }

        resp = await do_post("/api/users/bob/groups", data, authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "User does not exist"
        }


class TestRemove:

    async def test_valid(self, test_db, do_delete, create_user):
        """
        Test that a group is removed from the user for a valid request.
         
        """
        test_db.users.insert(create_user("bob"))

        resp = await do_delete("/api/users/bob", authorize=True, permissions=["manage_users"])

        assert resp.status == 204

    async def test_does_not_exist(self, do_delete):
        """
        Test that a request to remove a non-existent user results in a ``404`` response.
                 
        """
        resp = await do_delete("/api/users/bob", authorize=True, permissions=["manage_users"])

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "User does not exist"
        }
