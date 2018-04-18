import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.mark.parametrize("not_found", [False, True])
async def test_get(not_found, mocker, resp_is, spawn_client):
    client = await spawn_client(authorize=True)

    m_search = mocker.patch("virtool.genbank.search", new=make_mocked_coro(None if not_found else "foobar"))
    m_fetch = mocker.patch("virtool.genbank.fetch", new=make_mocked_coro({"accession": "baz"}))

    resp = await client.get("/api/genbank/NC_016574.1")

    assert m_search.call_args[0][0] == client.app["settings"]
    assert m_search.call_args[0][2] == "NC_016574.1"

    if not_found:
        await resp_is.not_found(resp)

    else:
        assert m_fetch.call_args[0][0] == client.app["settings"]
        assert m_fetch.call_args[0][2] == "foobar"

        assert resp.status == 200
        assert await resp.json() == {"accession": "baz"}
