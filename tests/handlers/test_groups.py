from aiohttp.test_utils import make_mocked_coro


class TestFind:

    async def test_no_params(self, spawn_client, all_permissions, no_permissions):
        """
        Test that a ``GET /api/groups`` return a complete list of groups.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_many([
            {
                "_id": "test",
                "permissions": all_permissions
            },
            {
                "_id": "limited",
                "permissions": no_permissions
            }
        ])

        resp = await client.get("/api/groups")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "id": "administrator",
                "permissions": all_permissions
            },
            {
                "id": "test",
                "permissions": all_permissions
            },
            {
                "id": "limited",
                "permissions": no_permissions
            }
        ]


class TestCreate:

    async def test_valid(self, spawn_client, no_permissions):
        """
        Test that a group can be added to the database at ``POST /api/groups/:group_id``.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.post("/api/groups", data={
            "group_id": "test"
        })

        assert resp.status == 201

        assert resp.headers["Location"] == "/api/groups/test"

        assert await resp.json() == {
            "id": "test",
            "permissions": no_permissions
        }

        assert await client.db.groups.find_one("test") == {
            "_id": "test",
            "permissions": no_permissions
        }

    async def test_exists(self, spawn_client, resp_is, all_permissions):
        """
        Test that a 409 is returned when attempting to create a new group at ``POST /api/groups/:group_id`` when the
        ``group_id`` already exists.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": all_permissions
        })

        resp = await client.post("/api/groups", data={
            "group_id": "test"
        })

        assert await resp_is.conflict(resp, "Group already exists")

    async def test_missing(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.post("/api/groups", data={
            "test": "test"
        })

        assert await resp_is.invalid_input(resp, {
            "test": ["unknown field"],
            "group_id": ["required field"]
        })

    async def test_wrong_type(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.post("/api/groups", data={
            "group_id": 1
        })

        assert await resp_is.invalid_input(resp, {
            "group_id": ["must be of string type"]
        })


class TestGet:

    async def test_valid(self, spawn_client, all_permissions):
        """
        Test that a ``GET /api/groups/:group_id`` return the correct group.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": all_permissions
        })

        resp = await client.get("/api/groups/test")

        assert await resp.json() == {
            "id": "test",
            "permissions": all_permissions
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a ``GET /api/groups/:group_id`` returns 404 for a non-existent ``group_id``.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.get("/api/groups/foo")

        assert await resp_is.not_found(resp)


class TestUpdatePermissions:

    async def test(self, spawn_client, no_permissions):
        """
        Test that a valid request results in permission changes.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": no_permissions
        })

        resp = await client.patch("/api/groups/test", data={
            "modify_virus": True
        })

        assert resp.status == 200

        no_permissions["modify_virus"] = True

        assert await resp.json() == {
            "id": "test",
            "permissions": no_permissions
        }

        assert await client.db.groups.find_one("test") == {
            "_id": "test",
            "permissions": no_permissions
        }

    async def test_invalid_input(self, spawn_client, resp_is, no_permissions):
        """
        Test that an invalid permission key results in a ``422`` response.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": no_permissions
        })

        resp = await client.patch("/api/groups/test", data={
            "foo_bar": True
        })

        assert await resp_is.invalid_input(resp, {
            "foo_bar": ["unknown field"]
        })

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that updating an non-existent group results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.patch("/api/groups/test", data={
            "modify_virus": True
        })

        assert await resp_is.not_found(resp)


class TestRemove:

    async def test_valid(self, monkeypatch, spawn_client, no_permissions):
        """
        Test that an existing document can be removed at ``DELETE /api/groups/:group_id``.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        await client.db.groups.insert_one({
            "_id": "test",
            "permissions": no_permissions
        })

        m = make_mocked_coro(None)

        monkeypatch.setattr("virtool.user_groups.update_member_users", m)

        resp = await client.delete("/api/groups/test")

        assert resp.status == 204

        assert not await client.db.groups.count({"_id": "test"})

        assert m.call_args == (
            (client.db, "test"),
            dict(remove=True)
        )

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that 404 is returned for non-existent group.

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.delete("/api/groups/test")

        assert await resp_is.not_found(resp)

        assert resp.status == 404

    async def test_administrator(self, spawn_client, resp_is):
        """
        Test that the administrator group cannot be removed (400).

        """
        client = await spawn_client(authorize=True, permissions=["manage_users"])

        resp = await client.delete("/api/groups/administrator")

        assert await resp_is.bad_request(resp, "Cannot remove administrator group")
