import pytest


@pytest.mark.apitest
async def test_find(spawn_client, pg, snapshot):
    client = await spawn_client(authorize=True)

    url = "/source/permissions"

    resp = await client.get(url)

    assert resp.status == 200
    assert await resp.json() == snapshot
