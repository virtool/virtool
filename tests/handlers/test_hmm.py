import pytest


@pytest.fixture
def hmm_document():
    return {
        "_id": "f8666902",
        "count": 4,
        "length": 199,
        "names": [
            "ORF-63",
            "ORF67",
            "hypothetical protein"
        ],
        "entries": [
            {
                "gi": "438000415",
                "organism": "Thysanoplusia orichalcea nucleopolyhedrovirus",
                "name": "hypothetical protein",
                "accession": "YP_007250520.1"
            },
            {
                "gi": "114679914",
                "organism": "Leucania separata nucleopolyhedrovirus",
                "name": "ORF67",
                "accession": "YP_758364.1"
            },
            {
                "gi": "209170953",
                "organism": "Agrotis ipsilon multiple nucleopolyhedrovirus",
                "name": "agip69",
                "accession": "YP_002268099.1"
            },
            {
                "gi": "90592780",
                "organism": "Agrotis segetum nucleopolyhedrovirus",
                "name": "ORF-63",
                "accession": "YP_529733.1"
            }
        ],
        "total_entropy": 101.49,
        "families": {
            "Baculoviridae": 3
        },
        "genera": {
            "Alphabaculovirus": 3
        },
        "cluster": 3463,
        "mean_entropy": 0.51
    }


class TestFind:

    async def test_no_params(self, tmpdir, spawn_client, hmm_document):
        """
        Check that a request with no URL parameters returns a list of HMM annotation documents.

        """
        client = await spawn_client()

        client.app["settings"] = {
            "data_path": str(tmpdir)
        }

        tmpdir.mkdir("hmm")

        hmm_document["hidden"] = False

        await client.db.hmm.insert(hmm_document)

        resp = await client.get("/api/hmms")

        assert resp.status == 200

        assert await resp.json() == {
            "total_count": 1,
            "found_count": 1,
            "page": 1,
            "page_count": 1,
            "per_page": 15,
            "file_exists": False,
            "documents": [
                {
                    "names": [
                        "ORF-63",
                        "ORF67",
                        "hypothetical protein"
                    ],
                    "id": "f8666902",
                    "cluster": 3463,
                    "count": 4,
                    "families": {
                        "Baculoviridae": 3
                    }
                }
            ]
        }


class TestGet:

    async def test_exists(self, spawn_client, hmm_document):
        """
        Check that a ``GET`` request for a valid annotation document results in a response containing that complete
        document.

        """
        client = await spawn_client()

        await client.db.hmm.insert_one(hmm_document)

        resp = await client.get("/api/hmms/f8666902")

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

        resp = await client.get("/api/hmms/foobar")

        assert await resp_is.not_found(resp)
