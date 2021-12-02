async def test_get(snapshot, spawn_client, test_settings):
    client = await spawn_client(authorize=True)

    resp = await client.get("/settings")

    assert resp.status == 200
    assert await resp.json() == snapshot


async def test_update(snapshot, spawn_client, test_settings):
    client = await spawn_client(authorize=True, administrator=True)

    data = {
        "enable_api": False,
        "enable_sentry": False,
        "minimum_password_length": 10
    }

    resp = await client.patch("/settings", data)

    assert resp.status == 200
    assert await resp.json() == snapshot
