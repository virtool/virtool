import asyncio
import signal
import concurrent.futures
import logging
import os
import subprocess
import sys

import aiofiles
import aiojobs.aiohttp
import pymongo
import pymongo.errors
from aiohttp import client, web
from motor import motor_asyncio

import virtool.db.settings
import virtool.http.auth
import virtool.app_routes
import virtool.config
import virtool.db.hmm
import virtool.db.iface
import virtool.db.references
import virtool.db.software
import virtool.db.status
import virtool.db.utils
import virtool.dispatcher
import virtool.errors
import virtool.files
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.jobs.manager
import virtool.logs
import virtool.organize
import virtool.resources
import virtool.sentry
import virtool.settings
import virtool.setup.setup
import virtool.utils

logger = logging.getLogger(__name__)


async def init_http_client(app: web.Application):
    """
    Create an async HTTP client session for the server.

    The client session is used to make requests to GitHub, NCBI, and https://www.virtool.ca.

    :param app: the application object

    """

    headers = {
        "User-Agent": "virtool/{}".format(app["version"]),
    }

    app["client"] = client.ClientSession(loop=app.loop, headers=headers)


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

    await scheduler.spawn(virtool.db.references.refresh_remotes(app))
    await scheduler.spawn(virtool.db.hmm.refresh(app))
    await scheduler.spawn(virtool.db.software.refresh(app))


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
        version = await find_server_version(app.loop, sys.path[0])

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
        return await app.loop.run_in_executor(thread_executor, func, *args)

    app["run_in_thread"] = run_in_thread
    app["executor"] = thread_executor

    process_executor = concurrent.futures.ProcessPoolExecutor()

    async def run_in_process(func, *args):
        return await app.loop.run_in_executor(process_executor, func, *args)

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
    if app["setup"] is None and app["force_settings"] is None:
        from_db = await virtool.db.settings.get(app["db"])
        app["settings"].update(from_db)


async def init_sentry(app):
    if not app["settings"]["no_sentry"] and app["settings"].get("enable_sentry", True):
        app["sentry"] = virtool.sentry.setup(app["version"])


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
    if app["setup"] is not None:
        return

    settings = app["settings"]

    db_client = motor_asyncio.AsyncIOMotorClient(
        settings["db_connection_string"],
        serverSelectionTimeoutMS=6000,
        io_loop=app.loop
    )

    try:
        await db_client.database_names()
    except pymongo.errors.ServerSelectionTimeoutError:
        logger.critical("Could not connect to MongoDB server")
        sys.exit(1)

    app["db"] = virtool.db.iface.DB(
        db_client[settings["db_name"]],
        app["dispatcher"].dispatch,
        app.loop
    )

    await app["db"].connect()


async def init_check_db(app):
    if app["setup"] is not None:
        return

    if app["settings"]["no_db_checks"]:
        return logger.info("Skipping database checks.")

    logger.info("Starting database checks. Do not interrupt. This may take several minutes.")

    db = app["db"]

    logger.info("Checking database...")
    await virtool.organize.organize(app)

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
    app["client_path"] = await virtool.utils.get_client_path()

    if app["client_path"] is None:
        logger.critical("Client files not found")
        sys.exit(1)

    app.router.add_static("/static", app["client_path"])


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

    app["file_manager"] = virtool.files.Manager(
        app.loop,
        app["executor"],
        app["db"],
        files_path,
        watch_path,
        clean_interval=20
    )

    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    await scheduler.spawn(app["file_manager"].run())


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


def create_app(force_settings=None):
    """
    Creates the Virtool application.

    - creates an returns an instance of :class:`aiohttp.web.Application`
    - sets up URL routing
    - initializes all main Virtool objects during ``on_startup``

    """
    config = force_settings

    if config is None:
        config = virtool.config.resolve()

    middlewares = [
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    setup_required = not os.path.exists("config.json")

    if config["no_setup"] and not setup_required:
        if not config["force_setup"]:
            middlewares.append(virtool.http.auth.middleware)

    app = web.Application(middlewares=middlewares)

    app["force_settings"] = force_settings
    app["settings"] = config
    app["setup"] = None

    if config["force_setup"] or setup_required:
        app["setup"] = dict()

    aiojobs.aiohttp.setup(app)

    app.on_startup.extend([
        init_version,
        init_client_path,
        init_setup,
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
        return os.execl(exe, exe, *sys.argv)

    if exe.endswith("run"):
        return os.execv(exe, sys.argv)

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
    virtool.logs.configure(True)

    app = create_app()

    loop = asyncio.get_event_loop()

    events = create_events()

    loop.add_signal_handler(signal.SIGINT, events["shutdown"].set)
    loop.add_signal_handler(signal.SIGTERM, events["shutdown"].set)

    app["events"] = events

    runner = await create_app_runner(app, app["settings"]["host"], app["settings"]["port"])

    _, pending = await asyncio.wait(
        [wait_for_restart(runner, events), wait_for_shutdown(runner, events)],
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()


async def find_server_version(loop, install_path="."):
    output = None

    try:
        output = await loop.run_in_executor(None, subprocess.check_output, ["git", "describe", "--tags"])
        output = output.decode().rstrip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    if output and "Not a git repository" not in output:
        return output

    try:
        version_file_path = os.path.join(install_path, "VERSION")

        async with aiofiles.open(version_file_path, "r") as version_file:
            content = await version_file.read()
            return content.rstrip()

    except FileNotFoundError:
        logger.critical("Could not determine software version.")
        return "Unknown"
