import aiohttp
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.errors


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


async def test_get_status(mocker, spawn_client):
    client = await spawn_client(authorize=True)

    mocker.patch("virtool.hmm.db.get_status", make_mocked_coro({"id": "hmm", "updating": True}))

    resp = await client.get("/api/hmms/status")

    assert resp.status == 200

    assert await resp.json() == {
        "id": "hmm",
        "updating": True
    }


@pytest.mark.parametrize("error", [None, "502_repo", "502_github", "404"])
async def test_get_release(error, mocker, spawn_client, resp_is):
    """
    Test that the endpoint returns the latest HMM release. Check that error responses are sent in all expected
    situations.

    """
    client = await spawn_client(authorize=True)

    m_fetch = make_mocked_coro(None if error == "404" else {"name": "v2.0.1", "newer": False})

    mocker.patch("virtool.hmm.db.fetch_and_update_release", new=m_fetch)

    if error == "502_repo":
        m_fetch.side_effect = virtool.errors.GitHubError("404 Not found")

    if error == "502_github":
        m_fetch.side_effect = aiohttp.ClientConnectorError("foo", OSError("Bar"))

    resp = await client.get("/api/hmms/status/release")

    m_fetch.assert_called_with(client.app)

    if error == "404":
        assert await resp_is.not_found(resp, "Release not found")
        return

    if error == "502_repo":
        assert await resp_is.bad_gateway(resp, "GitHub repository does not exist")
        return

    if error == "502_github":
        assert await resp_is.bad_gateway(resp, "Could not reach GitHub")
        return

    assert resp.status == 200
    assert await resp.json() == {
        "name": "v2.0.1",
        "newer": False
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, hmm_document, resp_is):
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


async def test_get_hmm_documents(dbi):
    await dbi.hmm.insert_one({"_id": "foo"})
    await dbi.hmm.insert_one({"_id": "bar"})

    documents = await virtool.hmm.db.get_hmm_documents(dbi)

    ids = [document["id"] for document in documents]

    assert "foo" in ids
    assert "bar" in ids
