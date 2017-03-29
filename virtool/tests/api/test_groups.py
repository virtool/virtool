import json

from virtool.web import create_app


class TestFind:

    async def test_no_params(self, test_client, test_db, all_permissions, no_permissions):
        """
        Test that a ``GET /api/groups`` return a complete list of groups.
         
        """
        test_db.groups.insert({
            "_id": "test",
            "permissions": all_permissions
        })

        test_db.groups.insert({
            "_id": "limited",
            "permissions": no_permissions
        })

        client = await test_client(create_app, "test")

        resp = await client.get("/api/groups")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "group_id": "test",
                "permissions": all_permissions
            },
            {
                "group_id": "limited",
                "permissions": no_permissions
            }
        ]


class TestCreate:

    async def test_valid(self, test_client, test_db, no_permissions):
        """
        Test that a group can be added to the database at ``POST /api/groups/:group_id``.
         
        """
        client = await test_client(create_app, "test")

        resp = await client.post("/api/groups", data=json.dumps({
            "group_id": "test"
        }))

        assert resp.status == 200

        assert await resp.json() == {
            "group_id": "test",
            "permissions": no_permissions
        }

        document = test_db.groups.find_one()

        assert document == {
            "_id": "test",
            "permissions": no_permissions
        }

    async def test_exists(self, test_client, test_db, all_permissions):
        """
        Test that a 404 is returned when attempting to create a new group at ``POST /api/groups/:group_id`` when the
        ``group_id`` already exists.
         
        """
        test_db.groups.insert_one({
            "_id": "test",
            "permissions": all_permissions
        })

        client = await test_client(create_app, "test")

        resp = await client.post("/api/groups", data=json.dumps({
            "group_id": "test"
        }))

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Group already exists"
        }

    async def test_missing(self, test_client):
        client = await test_client(create_app, "test")

        resp = await client.post("/api/groups", data=json.dumps({
            "test": "test"
        }))

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Missing group_id"
        }

    async def test_wrong_type(self, test_client):
        client = await test_client(create_app, "test")

        resp = await client.post("/api/groups", data=json.dumps({
            "group_id": 1
        }))

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Wrong type for group_id"
        }


class TestGet:

    async def test_valid(self, test_client, test_db, all_permissions):
        """
        Test that a ``GET /api/groups/:group_id`` return the correct group.
    
        """
        test_db.groups.insert({
            "_id": "test",
            "permissions": all_permissions
        })

        client = await test_client(create_app, "test")

        resp = await client.get("/api/groups/test")

        assert await resp.json() == {
            "group_id": "test",
            "permissions": all_permissions
        }

    async def test_not_found(self, test_client):
        """
        Test that a ``GET /api/groups/:group_id`` returns 404 for a non-existent ``group_id``.
         
        """
        client = await test_client(create_app, "test")

        resp = await client.get("/api/groups/foo")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestUpdatePermissions:

    async def test_valid(self, test_client, test_db, no_permissions):
        test_db.groups.insert({
            "_id": "test",
            "permissions": no_permissions
        })

        client = await test_client(create_app, "test")

        resp = await client.put("/api/groups/test", data=json.dumps({
            "modify_virus": True
        }))

        assert resp.status == 200

        no_permissions["modify_virus"] = True

        assert await resp.json() == {
            "group_id": "test",
            "permissions": no_permissions
        }

        document = test_db.groups.find_one({"_id": "test"})

        assert document == {
            "_id": "test",
            "permissions": no_permissions
        }

    async def test_invalid_key(self, test_client, test_db, no_permissions):
        test_db.groups.insert({
            "_id": "test",
            "permissions": no_permissions
        })

        client = await test_client(create_app, "test")

        resp = await client.put("/api/groups/test", data=json.dumps({
            "modify_virus": True
        }))

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }

    async def test_not_found(self, test_client):
        client = await test_client(create_app, "test")

        resp = await client.put("/api/groups/test", data=json.dumps({
            "modify_virus": True
        }))

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }
