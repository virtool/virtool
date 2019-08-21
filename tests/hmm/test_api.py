import pytest
from aiohttp.test_utils import make_mocked_coro


async def test_find(mocker, spawn_client, hmm_document):
    """
    Check that a request with no URL parameters returns a list of HMM annotation documents.

    """
    m = mocker.patch("virtool.hmm.db.get_status", make_mocked_coro({"id": "hmm"}))

    client = await spawn_client(authorize=True)

    hmm_document["hidden"] = False

    await client.db.hmm.insert_one(hmm_document)

    resp = await client.get("/api/hmms")

    assert resp.status == 200

    assert await resp.json() == {
        "total_count": 1,
        "found_count": 1,
        "page": 1,
        "page_count": 1,
        "per_page": 25,
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
        ],
        "status": {
            "id": "hmm"
        }
    }

    m.assert_called_with(client.db)


@pytest.mark.parametrize("error", [None, "404"])
async def test_exists(error, spawn_client, hmm_document, resp_is):
    """
    Check that a ``GET`` request for a valid annotation document results in a response containing that complete
    document.

    Check that a `404` is returned if the HMM does not exist.

    """
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.hmm.insert_one(hmm_document)

    resp = await client.get("/api/hmms/f8666902")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    expected = dict(hmm_document, id=hmm_document["_id"])
    expected.pop("_id")

    assert await resp.json() == expected
