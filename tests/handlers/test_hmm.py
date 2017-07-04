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
                "id": "f8666902",
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

        expected = dict(hmm_document, id=hmm_document["_id"])
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

    async def test_valid(self, test_db, do_patch, hmm_document):
        """
        Test that a valid request results in a document insertion and a valid response.
        
        """
        test_db.hmm.insert(hmm_document)

        data = {
            "label": "Hypothetical protein"
        }

        resp = await do_patch("/api/hmm/annotations/f8666902", data, authorize=True, permissions=["modify_hmm"])

        assert resp.status == 200

        expected = dict(hmm_document, id=hmm_document["_id"], label="Hypothetical protein")
        expected.pop("_id")

        assert await resp.json() == expected

    async def test_not_found(self, do_patch):
        """
        Test that a request to update a non-existent annotation results in a ``404`` response.
         
        """
        data = {
            "label": "Hypothetical protein"
        }

        resp = await do_patch("/api/hmm/annotations/f8666902", data, authorize=True, permissions=["modify_hmm"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }

    async def test_invalid_input(self, do_patch):
        """
        Test that invalid input results in a ``422`` response including error data.
         
        """
        data = {
            "label": 1234,
            "name": "Test"
        }

        resp = await do_patch("/api/hmm/annotations/f8666902", data, authorize=True, permissions=["modify_hmm"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "name": ["unknown field"],
                "label": ["must be of string type"]
            }
        }

'''
class TestImport:

    def test_valid(self, tmpdir, mock_transaction, hmm_collection):
        """
        Ensure that imported HMMs are properly inserted into the database collection.

        """
        files_path = os.path.join(str(tmpdir), "files")
        os.mkdir(files_path)

        test_file_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files", "annotations.json.gz")

        shutil.copy(
            test_file_path,
            files_path
        )

        hmm_collection.settings.data["data_path"] = str(tmpdir)

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "import_annotations",
            "data": {
                "file_id": "annotations.json.gz"
            }
        }, permissions=["modify_hmm"])

        yield hmm_collection.import_annotations(transaction)

        filter_keys = [
            "label",
            "length",
            "mean_entropy",
            "total_entropy",
            "genera",
            "families",
            "definition",
            "count",
            "cluster"
        ]

        cluster_two = yield hmm_collection.find_one({"cluster": 2})

        assert {key: cluster_two[key] for key in cluster_two if key in filter_keys} == {
            "cluster": 2,
            "count": 253,
            "definition": [
                "replication-associated protein",
                "replication associated protein",
                "Rep"
            ],
            "families": {
                "Geminiviridae": 235,
                "None": 2
            },
            "genera": {
                "Begomovirus": 208,
                "Curtovirus": 6,
                "Mastrevirus": 19,
                "None": 3,
                "Topocuvirus": 1
            },
            "label": "replication-associated protein",
            "length": 356,
            "mean_entropy": 0.52,
            "total_entropy": 185.12
        }

        assert cluster_two["_id"]
        assert cluster_two["_version"] == 0

        inserted = yield hmm_collection.db.find().to_list(None)

        assert len(inserted) == 7

        assert all(key in doc for key in filter_keys for doc in inserted)

    def test_non_zero(self, mock_transaction, hmm_collection, hmm_document):
        """
        Test that importing HMMs fails when the database is not empty.

        """
        yield hmm_collection.db.insert(hmm_document)

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "import_annotations",
            "data": {
                "file_id": "foobar-file"
            }
        }, permissions=["modify_hmm"])

        yield hmm_collection.import_annotations(transaction)

        assert transaction.fulfill_called == (False, dict(message="Annotations collection is not empty", warning=True))
'''
