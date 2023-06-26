from virtool.shutdown import (
    shutdown_http_client,
    shutdown_executors,
    shutdown_scheduler,
    shutdown_redis,
)
from virtool.startup import get_scheduler_from_app


async def test_shutdown_client(spawn_client):
    """
    Test that the HTTP async client is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    await shutdown_http_client(app)

    assert app["client"].closed


async def test_shutdown_executors(mocker, spawn_client):
    """
    Test that the app's `ThreadPoolExecutor` is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    mock = mocker.patch("concurrent.futures.process.ProcessPoolExecutor.shutdown")

    await shutdown_executors(app)

    assert mock.called


async def test_shutdown_scheduler(spawn_client):
    """
    Test that the app's `aiojobs` scheduler is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    scheduler = get_scheduler_from_app(app)

    await shutdown_scheduler(app)

    assert scheduler.closed


async def test_shutdown_redis(spawn_client):
    client = await spawn_client(authorize=True)
    app = client.app

    await shutdown_redis(app)

    assert app["redis"].closed
