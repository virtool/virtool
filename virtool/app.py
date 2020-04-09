import asyncio
import concurrent.futures
import logging
import os
import signal
import sys

import aiojobs.aiohttp
import pymongo
import pymongo.errors
from aiohttp import client, web
from motor import motor_asyncio

import virtool.app_routes
import virtool.config
import virtool.db.core
import virtool.db.migrate
import virtool.db.utils
import virtool.dispatcher
import virtool.errors
import virtool.files.manager
import virtool.hmm.db
import virtool.http.auth
import virtool.http.csp
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.jobs.manager
import virtool.logs
import virtool.references.db
import virtool.resources
import virtool.sentry
import virtool.settings.db
import virtool.settings.schema
import virtool.setup.setup
import virtool.software.db
import virtool.utils
import virtool.version

logger = logging.getLogger(__name__)


async def init_http_client(app: web.Application):
    """
    Create an async HTTP client session for the server.

    The client session is used to make requests to GitHub, NCBI, and https://www.virtool.ca.

    :param app: the application object

    """
    version = app["version"]

    headers = {
        "User-Agent": f"virtool/{version}",
    }

    app["client"] = client.ClientSession(headers=headers)


async def init_refresh(app: web.Application):
    """
    Start async jobs for checking for new remote reference, HMM, and software releases.

    :param app: the application object

    """
    if app["setup"] is not None:
        return

    if app["settings"]["no_refreshing"]:
        return logger.info("Running without automatic update checking.")

    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    await scheduler.spawn(virtool.references.db.refresh_remotes(app))
    await scheduler.spawn(virtool.hmm.db.refresh(app))
    await scheduler.spawn(virtool.software.db.refresh(app))


async def init_version(app: web.Application):
    """
    Bind the application version to the application state `dict`.

    The value will come by checking `--force-version`, the `VERSION` file, or the current Git tag if the containing
    folder is a Git repository.

    :param app: the application object

    """

    force_version = app["settings"]["force_version"]

    if force_version:
        version = force_version
    else:
        version = await virtool.version.determine_server_version(sys.path[0])

    logger.info(f"Virtool {version}")

    app["version"] = version


async def init_executors(app: web.Application):
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


async def init_resources(app: web.Application):
    """
    Set an initial value for the application resource values.

    This value will be updated every time a client GETs `/api/jobs/resources`.

    :param app: the application object

    """
    app["resources"] = virtool.resources.get()


async def init_settings(app):
    """
    Draws settings from the settings database collection and populates `app["settings"`.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    if app["setup"] is None:
        from_db = await virtool.settings.db.get(app["db"])
        app["settings"].update(from_db)


async def init_sentry(app):
    if not app["settings"]["no_sentry"] and app["settings"].get("enable_sentry", True) and not app["settings"]["dev"]:
        logger.info("Configuring Sentry")
        virtool.sentry.setup(app["version"])

    else:
        logger.info("Skipped configuring Sentry")


async def init_dispatcher(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Dispatcher` object and attaches it to
    the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    if app["setup"] is None:
        app["dispatcher"] = virtool.dispatcher.Dispatcher()


async def init_db(app):
    """
    An application ``on_startup`` callback that attaches an instance of :class:`~AsyncIOMotorClient` and the ``db_name``
    to the Virtool ``app`` object. Also initializes collection indices.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    if app["setup"] is None:
        settings = app["settings"]

        db_client = motor_asyncio.AsyncIOMotorClient(
            settings["db_connection_string"],
            serverSelectionTimeoutMS=6000
        )

        try:
            await db_client.list_database_names()
        except pymongo.errors.ServerSelectionTimeoutError:
            logger.critical("Could not connect to MongoDB server")
            sys.exit(1)

        await virtool.db.utils.check_mongo_version(db_client, logger)

        app["db"] = virtool.db.core.DB(
            db_client[settings["db_name"]],
            app["dispatcher"].dispatch
        )


async def init_check_db(app):
    if app["setup"] is not None:
        return

    if app["settings"]["no_db_checks"]:
        return logger.info("Skipping database checks.")

    logger.info("Starting database checks. Do not interrupt. This may take several minutes.")

    db = app["db"]

    logger.info("Checking database...")
    await virtool.db.migrate.migrate(app)

    logger.info("Creating database indexes...")
    await db.analyses.create_index("sample.id")
    await db.analyses.create_index([("created_at", -1)])
    await db.history.create_index("otu.id")
    await db.history.create_index("index.id")
    await db.history.create_index("created_at")
    await db.history.create_index([("otu.name", 1)])
    await db.history.create_index([("otu.version", -1)])
    await db.indexes.drop_indexes()
    await db.indexes.create_index([("version", 1), ("reference.id", 1)], unique=True)
    await db.keys.create_index("id", unique=True)
    await db.keys.create_index("user.id")
    await db.samples.create_index([("created_at", pymongo.DESCENDING)])
    await db.sequences.create_index("otu_id")
    await db.otus.create_index("name")
    await db.otus.create_index([
        ("_id", pymongo.ASCENDING),
        ("isolate.id", pymongo.ASCENDING)
    ])
    await db.otus.create_index("abbreviation")


async def init_client_path(app):
    if not app["settings"]["no_client"]:
        app["client_path"] = await virtool.utils.get_client_path()

        if app["client_path"] is None:
            logger.critical("Client files not found")
            sys.exit(1)

        app.router.add_static("/static", app["client_path"])


async def init_events(app):
    events = create_events()

    loop = asyncio.get_event_loop()

    loop.add_signal_handler(signal.SIGINT, events["shutdown"].set)
    loop.add_signal_handler(signal.SIGTERM, events["shutdown"].set)

    app["events"] = events


async def init_job_manager(app):
    """
    An application `on_startup` callback that initializes a Virtool :class:`virtool.job_manager.Manager` object and
    puts it in app state.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    if app["setup"] is not None:
        return

    if app["settings"]["no_job_manager"]:
        return logger.info("Running without job manager")

    capture_exception = None

    if "sentry" in app:
        capture_exception = app["sentry"].captureException

    app["jobs"] = virtool.jobs.manager.IntegratedManager(app, capture_exception)

    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    await scheduler.spawn(app["jobs"].run())


async def init_file_manager(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`virtool.file_manager.Manager` object and
    attaches it to the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    if app["setup"] is not None:
        return

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

    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    await scheduler.spawn(app["file_manager"].run())


async def init_paths(app):
    if app["setup"] is None and app["settings"]["no_file_checks"] is False:
        logger.info("Checking application data")
        virtool.utils.ensure_data_dir(app["settings"]["data_path"])

        try:
            os.mkdir(app["settings"]["watch_path"])
        except FileExistsError:
            pass


async def init_routes(app):
    if app["setup"] is None:
        logger.debug("Setting up routes")
        virtool.app_routes.setup_routes(app)


async def init_setup(app):
    if app["setup"] is not None:
        virtool.setup.setup.setup_routes(app)
        app["setup"] = virtool.setup.setup.get_defaults()


async def on_shutdown(app):
    """
    A function called when the app is shutting down.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    logger.debug("Shutting down")

    await app["client"].close()

    try:
        await app["dispatcher"].close()
    except KeyError:
        pass

    try:
        app["executor"].shutdown(wait=True)
    except KeyError:
        pass

    try:
        app["process_executor"].shutdown(wait=True)
    except KeyError:
        pass

    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)
    await scheduler.close()


def temp_init_thing(do_setup, config):
    async def func(app):
        app["settings"] = config
        app["setup"] = None

        if do_setup:
            app["setup"] = dict()

    return func


def create_app(config):
    """
    Creates the Virtool application.

    """
    middlewares = [
        virtool.http.csp.middleware,
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    do_setup = virtool.config.should_do_setup(config)

    if not do_setup:
        # Don't use authentication in setup mode.
        middlewares.append(virtool.http.auth.middleware)

    app = web.Application(middlewares=middlewares)

    aiojobs.aiohttp.setup(app)

    app.on_response_prepare.append(virtool.http.csp.on_prepare)

    app.on_startup.extend([
        temp_init_thing(do_setup, config),
        init_events,
        init_version,
        init_client_path,
        init_setup,
        init_paths,
        init_http_client,
        init_routes,
        init_executors,
        init_dispatcher,
        init_db,
        init_settings,
        init_sentry,
        init_check_db,
        init_resources,
        init_job_manager,
        init_file_manager,
        init_refresh
    ])

    app.on_shutdown.append(on_shutdown)

    return app


def create_events() -> dict:
    """
    Create and store :class:`asyncio.Event` objects for triggering an application restart or shutdown.

    :return: a `dict` containing :class:`~asyncio.Event` objects for restart and shutdown

    """
    return {
        "restart": asyncio.Event(),
        "shutdown": asyncio.Event()
    }


async def wait_for_restart(runner: web.AppRunner, events: dict):
    """
    Wait for the shutdown event and restart if it is encountered.

    Restart is accomplished using :func:`os.execl` or :func:`os.execv` after cleaning up the `runner`.

    :param runner: the :class:`~aiohttp.web.AppRunner` returned by :func:`.create_app_runner`
    :param events: a dict containing the `restart` and `shutdown` :class:`~asyncio.Event` objects

    """
    await events["restart"].wait()
    await asyncio.sleep(0.5)
    await runner.cleanup()

    exe = sys.executable

    if exe.endswith("python") or "python3" in exe:
        os.execl(exe, exe, *sys.argv)
        return

    if exe.endswith("run"):
        os.execv(exe, sys.argv)
        return

    raise SystemError("Could not determine executable type")


async def wait_for_shutdown(runner: web.AppRunner, events: dict):
    """
    Wait for the shutdown event and terminate if it is encountered.

    :param runner: the :class:`~aiohttp.web.AppRunner` returned by :func:`.create_app_runner`
    :param events: a dict containing the `restart` and `shutdown` :class:`~asyncio.Event` objects

    """
    await events["shutdown"].wait()
    await asyncio.sleep(0.5)
    await runner.cleanup()


async def create_app_runner(app: web.Application, host: str, port: int) -> web.AppRunner:
    """
    Create an :class:`aiohttp.web.AppRunner` to allow customization of signal handlers.

    The basic :func:`aiohttp.web.run_app` sets up handlers for `SIGINT` and `SIGTERM` that can interfere with Virtool
    code such as that for restarting the server after software update. This custom runner allows handling of signals
    as well as restart and shutdown events from users.

    https://docs.aiohttp.org/en/stable/web_advanced.html#application-runners

    :param app: the application
    :param host: the host to listen on
    :param port: the port to listen on
    :return: a custom :class:`~aiohttp.web.AppRunner`

    """
    runner = web.AppRunner(app)

    await runner.setup()

    site = web.TCPSite(runner, host, port)

    await site.start()

    logger.info(f"Listening at http://{host}:{port}")

    return runner


async def run():
    config = virtool.config.resolve()

    virtool.logs.configure(config["dev"])

    app = create_app(config)

    runner = await create_app_runner(app, config["host"], config["port"])

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, app["events"]), wait_for_shutdown(runner, app["events"])],
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()


