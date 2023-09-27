from virtool.shutdown import (
    shutdown_http_client,
    shutdown_redis,
)


async def test_shutdown_client(spawn_client):
    """Test that the HTTP async client is properly closed on shutdown."""
    client = await spawn_client(authenticated=True)
    await shutdown_http_client(client.app)
    assert client.app["client"].closed


async def test_shutdown_redis(spawn_client):
    """Test that the Redis connection is properly closed on shutdown."""
    client = await spawn_client(authenticated=True)
    await shutdown_redis(client.app)
    assert client.app["redis"].closed
