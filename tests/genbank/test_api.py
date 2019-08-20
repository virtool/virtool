import aiohttp.client
import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, mocker, resp_is, spawn_client):
    client = await spawn_client(authorize=True)

    expected = {
        "accession": "baz"
    }

    m_fetch = mocker.patch("virtool.genbank.http.fetch", make_mocked_coro(None if error else expected))

    resp = await client.get("/api/genbank/NC_016574.1")

    if error:
        await resp_is.not_found(resp)
        return

    m_fetch.assert_called_with(
        client.app["settings"],
        mocker.ANY,
        "NC_016574.1"
    )

    assert isinstance(m_fetch.call_args[0][1], aiohttp.client.ClientSession)

    assert resp.status == 200
    assert await resp.json() == expected
