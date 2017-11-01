import datetime
from operator import itemgetter

from virtool.user import check_password


class TestFind:

    async def test_valid(self, spawn_client, create_user):
        """
        Test that a ``GET /users`` returns a list of users.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        user_ids = ["bob", "fred", "john"]

        await client.db.users.insert_many([create_user(user_id) for user_id in user_ids])

        resp = await client.get("/api/users")

        assert resp.status == 200

        base_dict = {
            "force_reset": False,
            "groups": [],
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "modify_host": False,
                "create_sample": False,
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
            "primary_group": "technician"
        }

        expected = [dict(base_dict, id=user_id) for user_id in user_ids + ["test"]]

        expected[3]["permissions"] = dict(base_dict["permissions"], manage_users=True)

        assert sorted(await resp.json(), key=itemgetter("id")) == sorted(expected, key=itemgetter("id"))


class TestGet:

    async def test_exists(self, spawn_client, create_user):
        """
        Test that a ``GET /api/users`` returns a list of users.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        user_ids = ["bob", "fred"]

        await client.db.users.insert_many([create_user(user_id) for user_id in user_ids])

        resp = await client.get("/api/users/fred")

        assert resp.status == 200

        assert await resp.json() == {
            "id": "fred",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "modify_host": False,
                "create_sample": False,
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
            "primary_group": "technician"
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a ``GET /api/users/:user_id`` for a non-existent ``user_id`` results in a ``404`` response.
        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.get("/api/users/fred")

        assert await resp_is.not_found(resp)


class TestCreate:

    async def test(self, monkeypatch, spawn_client, static_time):
        """
        Test that a valid request results in a user document being properly inserted.

        - check response
        - check database
        - check password

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        data = {
            "user_id": "bob",
            "password": "hello_world",
            "force_reset": False
        }

        monkeypatch.setattr("virtool.utils.timestamp", lambda: static_time)

        resp = await client.post("/api/users", data)

        assert resp.status == 200

        expected = {
            "id": "bob",
            "force_reset": False,
            "groups": [],
            "last_password_change": "2017-10-06T20:00:00Z",
            "identicon": "81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9",
            "permissions": {
                "modify_host": False,
                "create_sample": False,
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

        assert await client.db.users.find_one("bob", list(expected.keys())) == expected

        document = await client.db.users.find_one("bob", ["password"])

        assert check_password("hello_world", document["password"])

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that invalid and missing input data result in a ``422`` response with detailed error data.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        data = {
            "username": "bob",
            "password": 1234,
            "force_reset": False
        }

        resp = await client.post("/api/users", data)

        assert resp.status == 422

        assert await resp_is.invalid_input(resp, {
            "username": ["unknown field"],
            "password": ["must be of string type"],
            "user_id": ["required field"]
        })

    async def test_user_exists(self, spawn_client, resp_is):
        """
        Test that an input ``user_id`` that already exists results in a ``400`` response with informative error message.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        data = {
            "user_id": "test",
            "password": "hello_world",
            "force_reset": False
        }

        resp = await client.post("/api/users", data)

        assert await resp_is.conflict(resp, "User already exists")


class TestSetPassword:

    async def test_valid(self, monkeypatch, spawn_client, static_time, create_user):
        """
        Test that a valid request results in a password change.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        bob = dict(create_user("bob"), last_password_change=None)

        await client.db.users.insert_one(bob)

        data = {
            "password": "foo_bar"
        }

        monkeypatch.setattr("virtool.utils.timestamp", lambda: static_time)

        resp = await client.put("/api/users/bob/password", data)

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": False,
            "groups": [],
            "id": "bob",
            "last_password_change": "2017-10-06T20:00:00Z",
            "permissions": {
                "modify_host": False,
                "create_sample": False,
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
            "primary_group": "technician"
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a ``404`` response results when the ``user_id`` does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        data = {
            "password": "foo_bar"
        }

        resp = await client.put("/api/users/fred/password", data)

        assert await resp_is.not_found(resp)

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that a valid request results in a password change.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.put("/api/users/test/password", {"reset": False})

        assert resp.status == 422

        assert await resp_is.invalid_input(resp, {
            "password": ["required field"],
            "reset": ["unknown field"]
        })


class TestSetForceReset:

    async def test(self, spawn_client, create_user):
        """
        Test that a valid request results in a password change.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.users.insert_one(create_user("bob"))

        data = {
            "force_reset": True
        }

        resp = await client.put("/api/users/bob/reset", data)

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": True,
            "groups": [],
            "id": "bob",
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "modify_host": False,
                "create_sample": False,
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
            "primary_group": "technician"
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a ``404`` response results when the ``user_id`` does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        data = {
            "force_reset": False
        }

        resp = await client.put("/api/users/fred/reset", data)

        assert await resp_is.not_found(resp)

    async def test_invalid_input(self, spawn_client, create_user, resp_is):
        """
        Test that a valid request results in a change to the ``force_reset`` field.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.users.insert_one(create_user("bob"))

        data = {
            "unwanted": True,
            "force_reset": "False"
        }

        resp = await client.put("/api/users/bob/reset", data)

        assert await resp_is.invalid_input(resp, {
            "unwanted": ["unknown field"],
            "force_reset": ["must be of boolean type"]
        })


class TestAddGroup:

    async def test_valid(self, spawn_client, create_user, no_permissions):
        """
        Test that a valid request results in the addition of a group to a user document.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_many([
            {
                "_id": "tech",
                "permissions": dict(no_permissions, modify_virus=True)
            },
            {
                "_id": "test",
                "permissions": dict(no_permissions, rebuild_index=True)
            }
        ])

        await client.db.users.insert(create_user("bob"))

        data = {
            "group_id": "tech"
        }

        resp = await client.post("/api/users/bob/groups", data)

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": False,
            "groups": ["tech"],
            "id": "bob",
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "cancel_job": False,
                "create_sample": False,
                "manage_users": False,
                "modify_hmm": False,
                "modify_host": False,
                "modify_options": False,
                "modify_virus": True,
                "rebuild_index": False,
                "remove_host": False,
                "remove_job": False,
                "remove_virus": False
            },
            "primary_group": "technician"
        }

    async def test_user_not_found(self, spawn_client, no_permissions, resp_is):
        """
        Test that a request to remove a group from a non-existent user results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        })

        data = {
            "group_id": "tech"
        }

        resp = await client.post("/api/users/bob/groups", data)

        assert await resp_is.not_found(resp, "User not found")

    async def test_group_not_found(self, spawn_client, resp_is, create_user):
        """
        Test that a request to delete an non-existent group results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.users.insert_one(create_user("bob"))

        data = {
            "group_id": "foobar"
        }

        resp = await client.post("/api/users/bob/groups", data)

        assert await resp_is.not_found(resp, "Group not found")

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that problems in the request input result in a ``422`` response with the appropriate error data attached.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        data = {
            "group": "tech"
        }

        resp = await client.post("/api/users/bob/groups", data)

        assert await resp_is.invalid_input(resp, {
            "group": ["unknown field"],
            "group_id": ["required field"]
        })


class TestRemoveGroup:

    async def test(self, spawn_client, create_user, no_permissions):
        """
        Test that a valid request can result in removal of a group from a user and recalculation of the user"s
        permissions.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_many([
            {
                "_id": "tech",
                "permissions": dict(no_permissions, modify_virus=True)
            },
            {
                "_id": "test",
                "permissions": dict(no_permissions, rebuild_index=True)
            }
        ])

        await client.db.users.insert_one(create_user(
            "bob",
            groups=["tech", "test"],
            permissions=["modify_virus", "rebuild_index"]
        ))

        await client.db.users.update_one({"_id": "bob"}, {
            "$set": {
                "primary_group": "tech"
            }
        })

        assert await client.db.users.find_one("bob", ["_id", "groups", "permissions"]) == {
            "_id": "bob",
            "groups": ["tech", "test"],
            "permissions": dict(no_permissions, modify_virus=True, rebuild_index=True)
        }

        resp = await client.delete("/api/users/bob/groups/tech")

        assert resp.status == 200

        assert await resp.json() == {
            "force_reset": False,
            "groups": ["test"],
            "id": "bob",
            "last_password_change": "2015-10-06T20:00:00Z",
            "permissions": {
                "cancel_job": False,
                "create_sample": False,
                "manage_users": False,
                "modify_hmm": False,
                "modify_host": False,
                "modify_options": False,
                "modify_virus": False,
                "rebuild_index": True,
                "remove_host": False,
                "remove_job": False,
                "remove_virus": False
            },
            "primary_group": ""
        }

    async def test_user_does_not_exist(self, spawn_client, resp_is, no_permissions):
        """
        Test that a ``404`` response results if the ``user_id`` does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "tech",
            "permissions": dict(no_permissions, modify_virus=True)
        })

        data = {
            "group_id": "tech"
        }

        resp = await client.post("/api/users/bob/groups", data)

        assert await resp_is.not_found(resp, "User not found")


class TestRemove:

    async def test_valid(self, spawn_client, create_user):
        """
        Test that a group is removed from the user for a valid request.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.users.insert_one(create_user("bob"))

        resp = await client.delete("/api/users/bob")

        assert resp.status == 204

    async def test_does_not_exist(self, spawn_client, resp_is):
        """
        Test that a request to remove a non-existent user results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.delete("/api/users/bob")

        assert await resp_is.not_found(resp)
