class TestFind:

    async def test(self, test_db, do_get, test_changes):
        """
        Test that a list of processed change documents are returned with a ``200`` status.
         
        """
        test_db.history.insert_many(test_changes)

        resp = await do_get("/api/history")

        assert resp.status == 200

        expected = [dict(d, timestamp="2017-10-06T20:00:00Z", change_id=d.pop("_id")) for d in test_changes]

        for d in expected:
            d.pop("diff")

        assert await resp.json() == expected


class TestGet:

    async def test(self, test_db, do_get, test_changes):
        """
        Test that a specific history change can be retrieved by its change_id.
         
        """
        test_db.history.insert_many(test_changes)

        resp = await do_get("/api/history/6116cba1.1")

        assert resp.status == 200

        expected = dict(test_changes[0], change_id=test_changes[0].pop("_id"), timestamp="2017-10-06T20:00:00Z")

        assert await resp.json() == expected

    async def test_not_found(self, do_get):
        """
        Test that a specific history change can be retrieved by its change_id.

        """
        resp = await do_get("/api/history/foobar.1")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }
