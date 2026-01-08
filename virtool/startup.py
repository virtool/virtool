import asyncio
from concurrent.futures import ProcessPoolExecutor

from aiohttp import ClientSession, ClientTimeout
from pymongo.errors import CollectionInvalid
from structlog import get_logger

from virtool.config import get_config_from_app
from virtool.data.events import EventPublisher
from virtool.data.layer import create_data_layer
from virtool.data.utils import get_data_from_app
from virtool.hmm.tasks import HMMRefreshTask
from virtool.jobs.tasks import JobsTimeoutTask
from virtool.migration.pg import check_data_revision_version
from virtool.ml.tasks import MLModelsSyncTask
from virtool.mongo.connect import connect_mongo
from virtool.mongo.migrate import migrate_status
from virtool.mongo.utils import get_mongo_from_app
from virtool.pg.utils import connect_pg
from virtool.redis import Redis
from virtool.references.tasks import ReferenceReleasesRefreshTask, ReferencesCleanTask
from virtool.routes import setup_routes
from virtool.samples.tasks import SampleWorkflowsUpdateTask
from virtool.sentry import configure_sentry
from virtool.tasks.periodic import PeriodicTaskSpawner
from virtool.tasks.runner import TaskRunner
from virtool.types import App
from virtool.utils import get_http_session_from_app
from virtool.version import determine_server_version, get_version_from_app
from virtool.ws.server import WSServer

logger = get_logger("startup")


async def _connect_redis(redis_connection_string: str) -> Redis:
    redis = Redis(redis_connection_string)
    await redis.connect()
    return redis


async def startup_check_db(app: App):
    if get_config_from_app(app).no_check_db:
        return logger.info("skipping database checks")

    mongo = get_mongo_from_app(app)

    logger.info("checking database")
    await migrate_status(mongo)

    # Make sure the indexes collection exists before later trying to set an compound
    # index on it.
    try:
        await mongo.motor_database.create_collection("indexes")
    except CollectionInvalid:
        pass


async def startup_data(app: App) -> None:
    """Create the application data layer object.

    :param app: the application object
    """
    app["data"] = create_data_layer(
        get_mongo_from_app(app),
        app["pg"],
        get_config_from_app(app),
        get_http_session_from_app(app),
        app["redis"],
    )


async def startup_databases(app: App) -> None:
    """Connects to MongoDB, Redis and Postgres concurrently

    :param app: the app object

    """
    config = get_config_from_app(app)

    mongo, pg, redis = await asyncio.gather(
        connect_mongo(
            config.mongodb_connection_string,
            config.mongodb_database,
        ),
        connect_pg(config.postgres_options),
        _connect_redis(config.redis_connection_string),
    )

    if not get_config_from_app(app).no_revision_check:
        await check_data_revision_version(pg)

    app.update(
        {
            "mongo": mongo,
            "pg": pg,
            "redis": redis,
        },
    )


async def startup_events(app: App) -> None:
    """Create and run the event publisher."""
    app["events"] = EventPublisher(app["pg"])

    task = asyncio.create_task(app["events"].run())
    app.setdefault("background_tasks", []).append(task)


async def startup_executors(app: App) -> None:
    """An application ``on_startup`` callback that initializes a
    :class:`~ThreadPoolExecutor` and attaches it to the ``app`` object.

    :param app: the application object

    """
    loop = asyncio.get_event_loop()

    process_executor = ProcessPoolExecutor()

    async def run_in_process(func, *args):
        return await loop.run_in_executor(process_executor, func, *args)

    app["run_in_process"] = run_in_process
    app["process_executor"] = process_executor


async def startup_http_client_session(app: App) -> None:
    """Create an async HTTP client session for the server.

    The client session is used to make requests to GitHub, NCBI, and
    https://www.virtool.ca.

    :param app: the application object

    """
    logger.info("starting http client")

    timeout = ClientTimeout(total=30, sock_connect=10, sock_read=10)
    app["client"] = ClientSession(
        headers={"User-Agent": f"virtool/{get_version_from_app(app)}"},
        timeout=timeout,
    )


async def startup_routes(app: App) -> None:
    setup_routes(app, dev=get_config_from_app(app).dev)


async def startup_sentry(app: App) -> None:
    """Create a Sentry client and attach it to the application if a DSN was configured.

    :param app: the application object
    """
    if get_config_from_app(app).sentry_dsn:
        logger.info("configuring sentry")
        configure_sentry(get_config_from_app(app).sentry_dsn, app["version"])
    else:
        logger.info("skipped configuring sentry")


async def startup_settings(app: App) -> None:
    """Draws settings from the settings database collection.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object

    """
    await get_data_from_app(app).settings.ensure()


async def startup_task_runner(app: App) -> None:
    """An application `on_startup` callback that initializes a Virtool
    :class:`virtool.tasks.runner.TaskRunner` object and puts it in app state.

    :param app: the app object
    """
    task = asyncio.create_task(TaskRunner(app["data"]).run())
    app.setdefault("background_tasks", []).append(task)


async def startup_periodic_tasks(app: App) -> None:
    """Start the periodic task spawner for API servers.

    :param app: the app object
    """
    config = get_config_from_app(app)

    if config.no_periodic_tasks:
        logger.info("periodic tasks are disabled")
        return

    logger.info("periodic tasks are enabled")

    periodic_tasks = [
        (HMMRefreshTask, 600),
        (JobsTimeoutTask, 600),
        (MLModelsSyncTask, 600),
        (ReferenceReleasesRefreshTask, 600),
        (ReferencesCleanTask, 3600),
        (SampleWorkflowsUpdateTask, 3600),
    ]

    spawner = PeriodicTaskSpawner(app["pg"], app["data"].tasks)
    task = asyncio.create_task(spawner.run(periodic_tasks))
    app.setdefault("background_tasks", []).append(task)


async def startup_version(app: App) -> None:
    """Store and log the Virtool version.

    :param app: the application object

    """
    version = await asyncio.to_thread(determine_server_version)

    logger.info("starting virtool", version=version, mode=app["mode"])

    app["version"] = version


async def startup_ws(app: App) -> None:
    """Start the websocket server."""
    logger.info("starting websocket server")

    config = get_config_from_app(app)

    ws = WSServer(
        config.postgres_options,
        app["data"],
        app["redis"],
    )

    ws_task = asyncio.create_task(ws.run())
    cleanup_task = asyncio.create_task(
        ws.periodically_close_expired_websocket_connections(),
    )

    app.setdefault("background_tasks", []).extend([ws_task, cleanup_task])
    app["ws"] = ws
