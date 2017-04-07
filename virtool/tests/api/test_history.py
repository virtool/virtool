import operator

from virtool.history import processor


class TestFind:

    async def test(self, test_db, do_get, test_changes):
        test_db.history.insert_many(test_changes)

        resp = await do_get("/api/history")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "change_id": "c1e16d2c.10",
                "operation": "update",
                "index": "465428b0",
                "index_version": 1,
                "method_name": "verify_virus",
                "timestamp": "2017-03-07T15:52:12.676269Z",
                "user_id": "igboyes",
                "virus_id": "c1e16d2c",
                "virus_name": "Apple stem pitting virus and Apricot latent virus",
                "virus_version": 10
            },
            {
                "change_id": "190fe042.3",
                "operation": "update",
                "index": "465428b0",
                "index_version": 1,
                "method_name": "verify_virus",
                "timestamp": "2017-03-07T15:52:16.736736Z",
                "user_id": "igboyes",
                "virus_id": "190fe042",
                "virus_name": "Nectarine stem pitting associated virus",
                "virus_version": 3
            },
            {
                "change_id": "cf189b66.0",
                "operation": "update",
                "index": "9cd17bac",
                "index_version": 0,
                "method_name": "add",
                "timestamp": "2017-02-03T14:29:31.789583Z",
                "user_id": "igboyes",
                "virus_id": "cf189b66",
                "virus_name": "Iris yellow spot virus",
                "virus_version": 0
            }
        ]


class TestGet:

    async def test(self, test_db, do_get, test_changes):
        """
        Test that a specific history change can be retrieved by its change_id.
         
        """
        test_db.history.insert_many(test_changes)

        resp = await do_get("/api/history/c1e16d2c.10")

        assert resp.status == 200

        assert await resp.json() == {
            "annotation": None,
            "change_id": "c1e16d2c.10",
            "diff": [
                [
                    "change",
                    "modified",
                    [
                        True,
                        False
                    ]
                ],
                [
                    "change",
                    "_version",
                    [
                        9,
                        10
                    ]
                ]
            ],
            "index": "465428b0",
            "index_version": 1,
            "method_name": "verify_virus",
            "operation": "update",
            "timestamp": "2017-03-07T15:52:12.676269Z",
            "user_id": "igboyes",
            "virus_id": "c1e16d2c",
            "virus_name": "Apple stem pitting virus and Apricot latent virus",
            "virus_version": 10
        }

    async def test_not_found(self, do_get):
        """
        Test that a specific history change can be retrieved by its change_id.

        """
        resp = await do_get("/api/history/cf189b66.0")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }
