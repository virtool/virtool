import asyncio
import concurrent.futures
import logging
import signal
import sys
import typing
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import aiohttp.client
import aiohttp.web
import aiohttp.web_app
import aiojobs
import aiojobs.aiohttp
import pymongo.errors

import virtool.db.mongo
import virtool.pg.utils
import virtool.redis
from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.db.migrate import migrate
from virtool.dev.fake import create_fake_data_path, populate
from virtool.dispatcher.client import DispatcherClient
from virtool.dispatcher.dispatcher import Dispatcher
from virtool.dispatcher.events import DispatcherSQLEvents
from virtool.dispatcher.listener import RedisDispatcherListener
from virtool.fake.wrapper import FakerWrapper
from virtool.hmm.db import refresh
from virtool.jobs.client import JobsClient
from virtool.pg.testing import create_test_database
from virtool.references.db import refresh_remotes
from virtool.references.tasks import CreateIndexJSONTask, DeleteReferenceTask
from virtool.routes import setup_routes
from virtool.samples.tasks import CompressSamplesTask, MoveSampleFilesTask
from virtool.sentry import setup
from virtool.settings.db import ensure
from virtool.subtractions.db import check_subtraction_fasta_files
from virtool.subtractions.tasks import AddSubtractionFilesTask, WriteSubtractionFASTATask
from virtool.tasks.client import TasksClient
from virtool.tasks.runner import TaskRunner
from virtool.types import App
from virtool.uploads.tasks import MigrateFilesTask
from virtool.utils import random_alphanumeric, get_client_path, ensure_data_dir
from virtool.version import determine_server_version

logger = logging.getLogger("startup")


def create_events() -> dict:
    """
    Create and store :class:`asyncio.Event` objects for triggering an application restart or
    shutdown.

    :return: a `dict` containing :class:`~asyncio.Event` objects for restart and shutdown

    """
    return {
        "restart": asyncio.Event(),
        "shutdown": asyncio.Event()
    }


def get_scheduler_from_app(app: aiohttp.web_app.Application) -> aiojobs.Scheduler:
    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    if scheduler is None:
        return app["scheduler"]

    return scheduler


async def init_check_db(app: aiohttp.web_app.Application):
    if app["config"].get("no_check_db"):
        return logger.info("Skipping database checks")

    db = app["db"]

    logger.info("Checking database")
    await migrate(app)

    # Make sure the indexes collection exists before later trying to set an compound index on it.
    try:
        await db.motor_client.create_collection("indexes")
    except pymongo.errors.CollectionInvalid:
        pass

    logger.info("Checking database indexes")
    await virtool.db.mongo.create_indexes(db)


async def init_client_path(app: aiohttp.web_app.Application):
    if not app["settings"]["no_client"]:
        app["client_path"] = await get_client_path()

        if app["client_path"] is None:
            logger.critical("Client files not found")
            sys.exit(1)

        app.router.add_static("/static", app["client_path"])


async def init_db(app: App):
    """
    An application ``on_startup`` callback that attaches an instance of
    :class:`~AsyncIOMotorClient` and the ``db_name`` to the Virtool ``app`` object. Also
    initializes collection indices.

    :param app: the app object
    :type app: :class:`aiohttp.aiohttp.web.Application`

    """
    logger.info("Connecting to MongoDB")

    dispatcher_interface = DispatcherClient(app["redis"])
    await get_scheduler_from_app(app).spawn(dispatcher_interface.run())

    app["db"] = await virtool.db.mongo.connect(app["config"], dispatcher_interface.enqueue_change)
    app["dispatcher_interface"] = dispatcher_interface


async def init_dispatcher(app: aiohttp.web_app.Application):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Dispatcher` object
    and attaches it to the ``app`` object.

    :param app: the app object

    """
    logger.info("Starting dispatcher")

    channel, = await app["redis"].subscribe("channel:dispatch")

    event_watcher = DispatcherSQLEvents(app["dispatcher_interface"].enqueue_change)

    app["dispatcher"] = Dispatcher(
        app["pg"],
        app["db"],
        RedisDispatcherListener(channel)
    )

    await get_scheduler_from_app(app).spawn(app["dispatcher"].run())


async def init_events(app: aiohttp.web_app.Application):
    events = create_events()

    loop = asyncio.get_event_loop()

    loop.add_signal_handler(signal.SIGINT, events["shutdown"].set)
    loop.add_signal_handler(signal.SIGTERM, events["shutdown"].set)

    app["events"] = events


async def init_executors(app: aiohttp.web.Application):
    """
    An application ``on_startup`` callback that initializes a :class:`~ThreadPoolExecutor` and
    attaches it to the ``app`` object.

    :param app: the application object

    """
    loop = asyncio.get_event_loop()

    thread_executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)

    loop.set_default_executor(thread_executor)

    async def run_in_thread(func, *args):
        return await loop.run_in_executor(thread_executor, func, *args)

    app["run_in_thread"] = run_in_thread
    app["executor"] = thread_executor

    process_executor = concurrent.futures.ProcessPoolExecutor()

    async def run_in_process(func, *args):
        return await loop.run_in_executor(process_executor, func, *args)

    app["run_in_process"] = run_in_process
    app["process_executor"] = process_executor


async def init_fake(app: aiohttp.web_app.Application):
    if app["config"]["fake"]:
        app["fake"] = FakerWrapper()
        await populate(app)


async def init_fake_config(app: App):
    """
    If the ``fake`` config flag is set, patch the config so that the MongoDB and Postgres databases
    and the data directory are faked.

    :param app:

    """
    suffix = random_alphanumeric()

    if app["config"]["fake"]:
        url = urlparse(app["config"]["postgres_connection_string"])

        base_connection_string = urlunparse((
            url.scheme,
            url.netloc,
            "",
            "",
            "",
            ""
        ))

        name = f"fake_{suffix}"

        await create_test_database(
            base_connection_string,
            name
        )

        app["config"].update({
            "db_name": f"fake-{suffix}",
            "data_path": create_fake_data_path(),
            "postgres_connection_string": f"{base_connection_string}/{name}"
        })


async def init_jobs_client(app: aiohttp.web_app.Application):
    """
    An application `on_startup` callback that initializes a Virtool
    :class:`virtool.job_manager.Manager` object and puts it in app state.

    :param app: the app object
    :type app: :class:`aiohttp.aiohttp.web.Application`

    """
    app["jobs"] = JobsClient(app)


async def init_http_client(app: aiohttp.web.Application):
    """
    Create an async HTTP client session for the server.

    The client session is used to make requests to GitHub, NCBI, and https://www.virtool.ca.

    :param app: the application object

    """
    logging.info("Starting HTTP client")

    version = app["version"]

    headers = {
        "User-Agent": f"virtool/{version}",
    }

    app["client"] = aiohttp.client.ClientSession(headers=headers)


async def init_paths(app: aiohttp.web_app.Application):
    if app["settings"]["no_check_files"] is False:
        logger.info("Checking files")
        ensure_data_dir(app["settings"]["data_path"])


async def init_postgres(app: aiohttp.web_app.Application):
    """
     An application ``on_startup`` callback that attaches an instance of :class:`~AsyncConnection`
     to the Virtool ``app`` object.

     :param app: the app object

     """
    postgres_connection_string = app["config"]["postgres_connection_string"]

    logger.info("Connecting to PostgreSQL")

    app["pg"] = await virtool.pg.utils.connect(postgres_connection_string)


async def init_redis(app: typing.Union[dict, aiohttp.web_app.Application]):
    redis_connection_string = app["config"]["redis_connection_string"]
    logger.info("Connecting to Redis")
    app["redis"] = await virtool.redis.connect(redis_connection_string)


async def init_refresh(app: aiohttp.web.Application):
    """
    Start async jobs for checking for new remote reference and HMM releases.

    :param app: the application object

    """
    if app["settings"]["no_fetching"]:
        return logger.info("Running without automatic update checking")

    scheduler = get_scheduler_from_app(app)

    await scheduler.spawn(refresh_remotes(app))
    await scheduler.spawn(refresh(app))


async def init_routes(app: aiohttp.web_app.Application):
    logger.debug("Setting up routes")
    setup_routes(app)


async def init_sentry(app: typing.Union[dict, aiohttp.web_app.Application]):
    if (not app["settings"]["no_sentry"]
            and app["settings"].get("enable_sentry", True)
            and not app["settings"]["dev"]):
        logger.info("Configuring Sentry")
        setup(app["version"])

    else:
        logger.info("Skipped configuring Sentry")


async def init_settings(app: typing.Union[dict, aiohttp.web.Application]):
    """
    Draws settings from the settings database collection and populates `app["settings"`.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object

    """
    from_db = await ensure(app["db"])

    app["settings"] = {
        **app["config"],
        **from_db
    }


async def init_version(app: typing.Union[dict, aiohttp.web.Application]):
    """
    Bind the application version to the application state `dict`.

    The value will come by checking `--force-version`, the `VERSION` file, or the current Git tag
    if the containing folder is a Git repository.

    :param app: the application object

    """

    force_version = app["config"]["force_version"]

    if force_version:
        version = force_version
    else:
        version = await determine_server_version(Path(sys.path[0]))

    logger.info(f"Virtool {version}")
    logger.info(f"Mode: {app['mode']}")

    app["version"] = version


async def init_task_runner(app: aiohttp.web.Application):
    """
    An application `on_startup` callback that initializes a Virtool
    :class:`virtool.tasks.runner.TaskRunner` object and puts it in app state.

    :param app: the app object

    """
    scheduler = get_scheduler_from_app(app)
    channel, = await app["redis"].subscribe("channel:tasks")

    app["tasks"] = TasksClient(app["redis"], app["pg"])

    await scheduler.spawn(TaskRunner(channel, app).run())


async def init_tasks(app: aiohttp.web.Application):
    if app["config"].get("no_check_db"):
        return logger.info("Skipping subtraction FASTA files checks")

    scheduler = get_scheduler_from_app(app)

    logger.info("Checking subtraction FASTA files")
    subtractions_without_fasta = await check_subtraction_fasta_files(
        app["db"], app["settings"])
    for subtraction in subtractions_without_fasta:
        await app["tasks"].add(WriteSubtractionFASTATask, context={"subtraction": subtraction})

    logger.info("Checking index JSON files")

    await app["tasks"].add(CreateIndexJSONTask)
    await app["tasks"].add(DeleteReferenceTask, context={"user_id": "virtool"})
    await app["tasks"].add(AddSubtractionFilesTask)
    await app["tasks"].add(StoreNuvsFilesTask)
    await app["tasks"].add(CompressSamplesTask)
    await app["tasks"].add(MoveSampleFilesTask)

    await scheduler.spawn(app["tasks"].add_periodic(MigrateFilesTask, 3600))
