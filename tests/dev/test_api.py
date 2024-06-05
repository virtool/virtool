from tests.fixtures.client import ClientSpawner


async def test_dev_mode(spawn_client: ClientSpawner):
    """Ensure that developer endpoint is not available when not in developer mode."""
    client = await spawn_client(authenticated=True)

    resp = await client.post("/dev", {"command": "foo"})

    assert resp.status == 404
