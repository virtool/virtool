import asyncio
import concurrent.futures
import logging
import os
import signal
import sys

import aiohttp.client
import aiohttp.web
import aiojobs
import aiojobs.aiohttp
import pymongo.errors

import virtool.config
import virtool.db.core
import virtool.db.migrate
import virtool.db.mongo
import virtool.db.utils
import virtool.dispatcher
import virtool.files.manager
import virtool.hmm.db
import virtool.jobs.agent
import virtool.jobs.interface
import virtool.redis
import virtool.references.db
import virtool.resources
import virtool.routes
import virtool.sentry
import virtool.settings.db
import virtool.software.db
import virtool.utils
import virtool.version

logger = logging.getLogger("startup")


def create_events() -> dict:
    """
    Create and store :class:`asyncio.Event` objects for triggering an application restart or shutdown.

    :return: a `dict` containing :class:`~asyncio.Event` objects for restart and shutdown

    """
    return {
        "restart": asyncio.Event(),
        "shutdown": asyncio.Event()
    }


def get_scheduler_from_app(app) -> aiojobs.Scheduler:
    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    if scheduler is None:
        return app["scheduler"]

    return scheduler


async def init_check_db(app):
    if app["config"].get("no_check_db"):
        return logger.info("Skipping database checks")

    db = app["db"]

    logger.info("Checking database")
    await virtool.db.migrate.migrate(app)

    logger.info("Checking database indexes")
    await db.analyses.create_index("sample.id")
    await db.analyses.create_index([("created_at", -1)])
    await db.history.create_index("otu.id")
    await db.history.create_index("index.id")
    await db.history.create_index("created_at")
    await db.history.create_index([("otu.name", 1)])
    await db.history.create_index([("otu.version", -1)])
    await db.indexes.create_index([("version", 1), ("reference.id", 1)], unique=True)
    await db.keys.create_index("id", unique=True)
    await db.keys.create_index("user.id")
    await db.otus.create_index([
        ("_id", pymongo.ASCENDING),
        ("isolate.id", pymongo.ASCENDING)
    ])
    await db.otus.create_index("name")
    await db.otus.create_index("nickname")
    await db.otus.create_index("abbreviation")
    await db.samples.create_index([("created_at", pymongo.DESCENDING)])
    await db.sequences.create_index("otu_id")
    await db.sequences.create_index("name")


async def init_client_path(app):
    if not app["settings"]["no_client"]:
        app["client_path"] = await virtool.utils.get_client_path()

        if app["client_path"] is None:
            logger.critical("Client files not found")
            sys.exit(1)

        app.router.add_static("/static", app["client_path"])


async def init_db(app):
    """
    An application ``on_startup`` callback that attaches an instance of :class:`~AsyncIOMotorClient` and the ``db_name``
    to the Virtool ``app`` object. Also initializes collection indices.

    :param app: the app object
    :type app: :class:`aiohttp.aiohttp.web.Application`

    """
    logger.info("Connecting to MongoDB")

    async def enqueue_change(interface, operation, id_list):
        await app["change_queue"].put([
            interface, operation, id_list
        ])

    app["db"] = await virtool.db.mongo.connect(app["config"], enqueue_change)


async def init_dispatcher(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Dispatcher` object and attaches it to
    the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.aiohttp.web.Application`

    """
    logger.info("Starting dispatcher")

    app["dispatcher"] = virtool.dispatcher.Dispatcher(
        app["db"],
        app["change_queue"]
    )

    await get_scheduler_from_app(app).spawn(app["dispatcher"].run())


async def init_events(app):
    events = create_events()

    loop = asyncio.get_event_loop()

    loop.add_signal_handler(signal.SIGINT, events["shutdown"].set)
    loop.add_signal_handler(signal.SIGTERM, events["shutdown"].set)

    app["events"] = events


async def init_executors(app: aiohttp.web.Application):
    """
    An application ``on_startup`` callback that initializes a :class:`~ThreadPoolExecutor` and attaches it to the
    ``app`` object.

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


async def init_file_manager(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`virtool.file_manager.Manager` object and
    attaches it to the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.aiohttp.web.Application`

    """
    if app["settings"]["no_file_manager"]:
        return logger.info("Running without file manager")

    files_path = os.path.join(app["settings"]["data_path"], "files")
    watch_path = app["settings"]["watch_path"]

    if not os.path.exists(files_path):
        logger.fatal(f"Files path path does not exist: '{files_path}'")
        sys.exit(1)

    if not os.path.exists(watch_path):
        logger.fatal(f"Watch path does not exist: '{watch_path}'")
        sys.exit(1)

    app["file_manager"] = virtool.files.manager.Manager(
        app["executor"],
        app["db"],
        files_path,
        watch_path,
        clean_interval=20
    )

    scheduler = get_scheduler_from_app(app)

    await scheduler.spawn(app["file_manager"].run())


async def init_job_interface(app):
    """
    An application `on_startup` callback that initializes a Virtool :class:`virtool.job_manager.Manager` object and
    puts it in app state.

    :param app: the app object
    :type app: :class:`aiohttp.aiohttp.web.Application`

    """
    if app["settings"].get("no_job_interface"):
        return logger.info("Running without job manager")

    app["jobs"] = virtool.jobs.interface.JobInterface(app)


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


async def init_paths(app):
    if app["settings"]["no_check_files"] is False:
        logger.info("Checking files")
        virtool.utils.ensure_data_dir(app["settings"]["data_path"])

        try:
            os.mkdir(app["settings"]["watch_path"])
        except (FileExistsError, KeyError):
            pass


async def init_redis(app):
    redis_connection_strong = app["config"].get("redis_connection_string")

    if not redis_connection_strong:
        logger.debug("Redis not configured")
        return

    logger.info("Connecting to Redis")
    app["redis"] = await virtool.redis.connect(redis_connection_strong)

    scheduler = get_scheduler_from_app(app)
    await scheduler.spawn(virtool.redis.listen_for_changes(app))


async def init_refresh(app: aiohttp.web.Application):
    """
    Start async jobs for checking for new remote reference, HMM, and software releases.

    :param app: the application object

    """
    if app["settings"]["no_fetching"]:
        return logger.info("Running without automatic update checking")

    scheduler = get_scheduler_from_app(app)

    await scheduler.spawn(virtool.references.db.refresh_remotes(app))
    await scheduler.spawn(virtool.hmm.db.refresh(app))
    await scheduler.spawn(virtool.software.db.refresh(app))


async def init_resources(app: aiohttp.web.Application):
    """
    Set an initial value for the application resource values.

    This value will be updated every time a client GETs `/api/jobs/resources`.

    :param app: the application object

    """
    app["resources"] = virtool.resources.get()


async def init_routes(app):
    logger.debug("Setting up routes")
    virtool.routes.setup_routes(app)


async def init_sentry(app):
    if not app["settings"]["no_sentry"] and app["settings"].get("enable_sentry", True) and not app["settings"]["dev"]:
        logger.info("Configuring Sentry")
        virtool.sentry.setup(app["version"])

    else:
        logger.info("Skipped configuring Sentry")


async def init_settings(app: aiohttp.web.Application):
    """
    Draws settings from the settings database collection and populates `app["settings"`.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object

    """
    from_db = await virtool.settings.db.ensure(app["db"])

    app["settings"] = {
        **app["config"],
        **from_db
    }


async def init_version(app: aiohttp.web.Application):
    """
    Bind the application version to the application state `dict`.

    The value will come by checking `--force-version`, the `VERSION` file, or the current Git tag if the containing
    folder is a Git repository.

    :param app: the application object

    """

    force_version = app["config"]["force_version"]

    if force_version:
        version = force_version
    else:
        version = await virtool.version.determine_server_version(sys.path[0])

    logger.info(f"Virtool {version}")
    logger.info(f"Mode: {app['mode']}")

    app["version"] = version
