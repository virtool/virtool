class TestFind:

    async def test_no_params(self, test_db, do_get, hmm_document):
        """
        Check that a request with no URL parameters returns a list of HMM annotation documents.        
         
        """
        test_db.hmm.insert(hmm_document)

        resp = await do_get("/api/hmm/annotations")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "label": "ORF-63",
                "hmm_id": "f8666902",
                "cluster": 3463,
                "count": 4,
                "families": {
                    "Baculoviridae": 3
                }
            }
        ]


class TestGet:

    async def test_exists(self, test_db, do_get, hmm_document):
        """
        Check that a ``GET`` request for a valid annotation document results in a response containing that complete
        document.
         
        """
        test_db.hmm.insert(hmm_document)

        resp = await do_get("/api/hmm/annotations/f8666902")

        assert resp.status == 200

        expected = dict(hmm_document, hmm_id=hmm_document["_id"])
        expected.pop("_id")

        assert await resp.json() == expected

    async def test_does_not_exist(self, test_db, do_get, hmm_document):
        """
        Check that a ``GET`` request for a valid annotation document results in a response containing that complete
        document.

        """
        test_db.hmm.insert(hmm_document)

        resp = await do_get("/api/hmm/annotations/foobar")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestUpdate:

    async def test_valid(self, test_db, do_put, hmm_document):
        """
        Test that a valid request results in a document insertion and a valid response.
        
        """
        test_db.hmm.insert(hmm_document)

        data = {
            "label": "Hypothetical protein"
        }

        resp = await do_put("/api/hmm/annotations/f8666902", data, authorize=True, permissions=["modify_hmm"])

        assert resp.status == 200

        expected = dict(hmm_document, hmm_id=hmm_document["_id"], label="Hypothetical protein")
        expected.pop("_id")

        assert await resp.json() == expected

    async def test_not_found(self, do_put):
        """
        Test that a request to update a non-existent annotation results in a ``404`` response.
         
        """
        data = {
            "label": "Hypothetical protein"
        }

        resp = await do_put("/api/hmm/annotations/f8666902", data, authorize=True, permissions=["modify_hmm"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }

    async def test_invalid_input(self, do_put):
        """
        Test that invalid input results in a ``422`` response including error data.
         
        """
        data = {
            "label": 1234,
            "name": "Test"
        }

        resp = await do_put("/api/hmm/annotations/f8666902", data, authorize=True, permissions=["modify_hmm"])

        assert resp.status == 422

        assert await resp.json() == {
            "message": "Invalid input",
            "errors": {
                "name": ["unknown field"],
                "label": ["must be of string type"]
            }
        }

    async def test_not_authorized(self, do_put):
        """
        Test that a request from an unauthorized session results in a ``403`` response. 

        """
        resp = await do_put("/api/hmm/annotations/f8666902", {})

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }

    async def test_not_permitted(self, do_put):
        """
        Test that a request from a session with inadequate permissions results in a ``403`` response. 

        """
        resp = await do_put("/api/hmm/annotations/f8666902", {}, authorize=True)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not permitted"
        }
