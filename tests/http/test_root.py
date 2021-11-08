async def test_get(spawn_client, snapshot):
    client = await spawn_client(authorize=True)
    resp = await client.get("/api")

    snapshot.assert_match(await resp.json())
