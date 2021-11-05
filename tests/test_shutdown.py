from sqlalchemy import text

from virtool.startup import get_scheduler_from_app
from virtool.shutdown import exit_client, exit_dispatcher, exit_executors, exit_scheduler, exit_redis, drop_fake_postgres


async def test_exit_client(spawn_client):
    """
    Test that the HTTP async client is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    await exit_client(app)

    assert app["client"].closed


async def test_exit_dispatcher(mocker, spawn_client):
    """
    Test that the app's `Dispatcher` object is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    mock = mocker.patch('virtool.dispatcher.dispatcher.Dispatcher.close')

    await exit_dispatcher(app)

    assert mock.called


async def test_exit_executors(mocker, spawn_client):
    """
    Test that the app's `ThreadPoolExecutor` is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    mock = mocker.patch('concurrent.futures.process.ProcessPoolExecutor.shutdown')

    await exit_executors(app)

    assert app["executor"]._shutdown
    assert mock.called


async def test_exit_scheduler(spawn_client):
    """
    Test that the app's `aiojobs` scheduler is properly closed on shutdown.

    """
    client = await spawn_client(authorize=True)
    app = client.app

    scheduler = get_scheduler_from_app(app)

    await exit_scheduler(app)

    assert scheduler.closed


async def test_exit_redis(spawn_client):
    client = await spawn_client(authorize=True)
    app = client.app

    await exit_redis(app)

    assert app["redis"].closed


async def test_drop_fake_postgres(spawn_client, pg_base_connection_string, pg_db_name, config):
    client = await spawn_client(authorize=True)
    app = client.app
    app["config"] = config

    app["config"].fake = True
    app["config"].postgres_connection_string = f"{pg_base_connection_string}/fake_{pg_db_name}"

    await drop_fake_postgres(app)

    async with app["pg"].begin() as conn:
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))

    assert result.all() == []
