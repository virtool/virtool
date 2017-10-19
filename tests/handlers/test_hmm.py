class TestFind:

    async def test_no_params(self, spawn_client, hmm_document):
        """
        Check that a request with no URL parameters returns a list of HMM annotation documents.

        """
        client = await spawn_client()

        await client.db.hmm.insert(hmm_document)

        resp = await client.get("/api/hmm/annotations")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "label": "ORF-63",
                "id": "f8666902",
                "cluster": 3463,
                "count": 4,
                "families": {
                    "Baculoviridae": 3
                }
            }
        ]


class TestGet:

    async def test_exists(self, spawn_client, hmm_document):
        """
        Check that a ``GET`` request for a valid annotation document results in a response containing that complete
        document.

        """
        client = await spawn_client()

        await client.db.hmm.insert_one(hmm_document)

        resp = await client.get("/api/hmm/annotations/f8666902")

        assert resp.status == 200

        expected = dict(hmm_document, id=hmm_document["_id"])
        expected.pop("_id")

        assert await resp.json() == expected

    async def test_does_not_exist(self, spawn_client, resp_is, hmm_document):
        """
        Check that a ``GET`` request for a valid annotation document results in a response containing that complete
        document.

        """
        client = await spawn_client()

        await client.db.hmm.insert_one(hmm_document)

        resp = await client.get("/api/hmm/annotations/foobar")

        assert await resp_is.not_found(resp)


class TestUpdate:

    async def test(self, spawn_client, hmm_document):
        """
        Test that a valid request results in a document insertion and a valid response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_hmm"])

        await client.db.hmm.insert_one(hmm_document)

        data = {
            "label": "Hypothetical protein"
        }

        resp = await client.patch("/api/hmm/annotations/f8666902", data)

        assert resp.status == 200

        expected = dict(hmm_document, id=hmm_document["_id"], label="Hypothetical protein")
        expected.pop("_id")

        assert await resp.json() == expected

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a request to update a non-existent annotation results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_hmm"])

        data = {
            "label": "Hypothetical protein"
        }

        resp = await client.patch("/api/hmm/annotations/f8666902", data)

        assert await resp_is.not_found(resp)

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that invalid input results in a ``422`` response including error data.

        """
        client = await spawn_client(authorize=True, permissions=["modify_hmm"])

        data = {
            "label": 1234,
            "name": "Test"
        }

        resp = await client.patch("/api/hmm/annotations/f8666902", data)

        assert await resp_is.invalid_input(resp, {
            "name": ["unknown field"],
            "label": ["must be of string type"]
        })
