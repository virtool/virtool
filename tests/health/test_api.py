async def test_is_alive(spawn_client):
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.get("/api/health/alive")

    assert resp.status == 200
    assert await resp.json() == {
        "alive": True
    }


async def test_is_ready(spawn_client):
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.get("/api/health/ready")

    assert resp.status == 200
    assert await resp.json() == {
        "ready": True
    }
