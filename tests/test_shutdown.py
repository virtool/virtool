import virtool.shutdown
import virtool.dispatcher

async def test_exit_client(spawn_client):
    """
    Test that the HTTP async client is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    await virtool.shutdown.exit_client(app)

    assert app["client"].closed


async def test_exit_dispatcher(mocker, spawn_client):
    """
    Test that the app's `Dispatcher` object is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    mock = mocker.patch('virtool.dispatcher.dispatcher.Dispatcher.close')

    await virtool.shutdown.exit_dispatcher(app)

    assert mock.called


async def test_exit_executors(mocker, spawn_client):
    """
    Test that the app's `ThreadPoolExecutor` is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    mock = mocker.patch('concurrent.futures.process.ProcessPoolExecutor.shutdown')

    await virtool.shutdown.exit_executors(app)

    assert app["executor"]._shutdown
    assert mock.called


async def test_exit_scheduler(spawn_client):
    """
    Test that the app's `aiojobs` scheduler is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    scheduler = virtool.startup.get_scheduler_from_app(app)

    await virtool.shutdown.exit_scheduler(app)

    assert scheduler.closed


async def test_exit_redis(spawn_client):
    client = await spawn_client(authorize=True)
    app = client.app

    await virtool.shutdown.exit_redis(app)

    assert app["redis"].closed

