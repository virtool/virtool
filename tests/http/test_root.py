import pytest


@pytest.mark.parametrize("dev", [True, False])
@pytest.mark.parametrize("first_user", [True, False])
async def test_get(dev, first_user, spawn_client, snapshot):
    client = await spawn_client(authorize=False)
    client.app["config"].dev = dev

    if first_user:
        await client.db.users.delete_one({})

    resp = await client.get("/api")

    assert await resp.json() == snapshot
