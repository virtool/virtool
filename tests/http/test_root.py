async def test_get(spawn_client, snapshot):
    client = await spawn_client(authorize=True)
    resp = await client.get("/api")

    assert await resp.json() == snapshot
