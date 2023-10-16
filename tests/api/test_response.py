async def test_not_found(spawn_client, snapshot):
    """Test that a 404 is returned when the job doesn't exist."""
    client = await spawn_client(authenticated=True)

    resp = await client.put("/foobar", data={})

    assert resp.status == 404
    assert await resp.json() == snapshot
