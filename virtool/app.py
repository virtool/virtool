import asyncio
import signal
import concurrent.futures
import logging
import os
import subprocess
import sys
from urllib.parse import quote_plus

import aiofiles
import aiojobs.aiohttp
import pymongo
import pymongo.errors
from aiohttp import client, web
from motor import motor_asyncio

import virtool.app_auth
import virtool.app_routes
import virtool.db.hmm
import virtool.db.iface
import virtool.db.references
import virtool.db.software
import virtool.db.status
import virtool.dispatcher
import virtool.errors
import virtool.files
import virtool.http.errors
import virtool.http.proxy
import virtool.http.query
import virtool.jobs.manager
import virtool.organize
import virtool.resources
import virtool.sentry
import virtool.settings
import virtool.setup
import virtool.utils

logger = logging.getLogger(__name__)


async def init_http_client(app):
    headers = {
        "user-agent": "virtool/{}".format(app["version"]),
    }

    app["client"] = client.ClientSession(loop=app.loop, headers=headers)


async def init_refresh(app):
    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)
    await scheduler.spawn(virtool.db.references.refresh_remotes(app))
    await scheduler.spawn(virtool.db.hmm.refresh(app))
    await scheduler.spawn(virtool.db.software.refresh(app))


async def init_version(app):
    if app["version"] is None:
        app["version"] = await find_server_version(app.loop, sys.path[0])


async def init_executors(app):
    """
    An application ``on_startup`` callback that initializes a :class:`~ThreadPoolExecutor` and attaches it to the
    ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    thread_executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    app.loop.set_default_executor(thread_executor)

    async def run_in_thread(func, *args):
        return await app.loop.run_in_executor(thread_executor, func, *args)

    app["run_in_thread"] = run_in_thread
    app["executor"] = thread_executor

    process_executor = concurrent.futures.ProcessPoolExecutor()

    async def run_in_process(func, *args):
        return await app.loop.run_in_executor(process_executor, func, *args)

    app["run_in_process"] = run_in_process
    app["process_executor"] = process_executor


async def init_resources(app):
    app["resources"] = virtool.resources.get()


async def init_settings(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Settings` object and attaches it to the
    ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["settings"] = virtool.settings.Settings()
    await app["settings"].load()


async def init_sentry(app):
    if app["settings"].get("enable_sentry", False):
        app["sentry"] = virtool.sentry.setup(app["version"])


async def init_dispatcher(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Dispatcher` object and attaches it to
    the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["dispatcher"] = virtool.dispatcher.Dispatcher()


async def init_db(app):
    """
    An application ``on_startup`` callback that attaches an instance of :class:`~AsyncIOMotorClient` and the ``db_name``
    to the Virtool ``app`` object. Also initializes collection indices.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    settings = app["settings"]

    app["db_host"] = app.get("db_host", None) or settings["db_host"]
    app["db_name"] = app.get("db_name", None) or settings["db_name"]

    db_host = app["db_host"]
    db_port = settings.get("db_port", 27017)

    auth_string = ""

    if settings.get("db_use_auth", False):
        db_username = quote_plus(settings["db_username"])
        db_password = quote_plus(settings["db_password"])

        auth_string = "{}:{}@".format(db_username, db_password)

    ssl_string = ""

    if settings.get("db_use_ssl", False):
        ssl_string += "?ssl=true"

    string = "mongodb://{}{}:{}/{}{}".format(auth_string, db_host, db_port, app["db_name"], ssl_string)

    app["db_connection_string"] = string

    db_client = motor_asyncio.AsyncIOMotorClient(
        string,
        serverSelectionTimeoutMS=6000,
        io_loop=app.loop
    )

    try:
        await db_client.database_names()
    except pymongo.errors.ServerSelectionTimeoutError:
        raise virtool.errors.MongoConnectionError(
            "Could not connect to MongoDB server at {}:{}".format(db_host, db_port)
        )

    app["db"] = virtool.db.iface.DB(db_client[app["db_name"]], app["dispatcher"].dispatch, app.loop)

    await app["db"].connect()


async def init_check_db(app):
    logger.info("Starting database checks. Do not interrupt. This may take several minutes.")

    db = app["db"]

    logger.info("Checking database...")
    await virtool.organize.organize(db, app["settings"], app["version"])

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
        return logger.warning("Client files not found")

    app.router.add_static("/static", app["client_path"])


async def init_job_manager(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`virtool.job_manager.Manager` object and
    attaches it to the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
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
    files_path = os.path.join(app["settings"].get("data_path"), "files")

    if os.path.isdir(files_path):
        app["file_manager"] = virtool.files.Manager(
            app.loop,
            app["executor"],
            app["db"],
            files_path,
            app["settings"].get("watch_path"),
            clean_interval=20
        )

        scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

        await scheduler.spawn(app["file_manager"].run())
    else:
        logger.warning("Did not initialize file manager. Path does not exist: {}".format(files_path))
        app["file_manager"] = None


async def init_routes(app):
    virtool.app_routes.setup_routes(app)


async def init_setup(app):
    virtool.setup.setup_routes(app)

    app["setup"] = {
        **virtool.setup.DB_VALUES,
        **virtool.setup.FIRST_USER_VALUES,
        "data_path": "",
        "watch_path": "",
        "errors": {
            **virtool.setup.DATA_ERRORS,
            **virtool.setup.DB_ERRORS,
            **virtool.setup.WATCH_ERRORS
        }
    }


async def on_shutdown(app):
    """
    A function called when the app is shutting down.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    logger.debug("Shutting down")

    await app["client"].close()
    await app["dispatcher"].close()

    app["executor"].shutdown(wait=True)
    app["process_executor"].shutdown(wait=True)

    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)
    await scheduler.close()


def create_app(
        loop,
        db_host=None,
        db_name=None,
        disable_job_manager=False,
        disable_file_manager=False,
        disable_refreshing=False,
        force_version=None,
        ignore_settings=False,
        no_sentry=False,
        skip_db_checks=False,
        skip_setup=False
):
    """
    Creates the Virtool application.

    - creates an returns an instance of :class:`aiohttp.web.Application`
    - sets up URL routing
    - initializes all main Virtool objects during ``on_startup``

    """
    middlewares = [
        virtool.http.errors.middleware,
        virtool.http.proxy.middleware,
        virtool.http.query.middleware
    ]

    if skip_setup:
        middlewares.append(virtool.app_auth.middleware)

    app = web.Application(middlewares=middlewares)

    aiojobs.aiohttp.setup(app)

    app["version"] = force_version
    app["db_name"] = db_name
    app["db_host"] = db_host

    app.on_startup.append(init_client_path)

    if not skip_setup:
        app.on_startup.append(init_setup)
    else:
        app.on_startup.append(init_version)
        app.on_startup.append(init_http_client)
        app.on_startup.append(init_routes)

        if not ignore_settings:
            app.on_startup.append(init_settings)

            if not no_sentry:
                app.on_startup.append(init_sentry)
        else:
            app["settings"] = dict()

        app.on_startup.append(init_executors)
        app.on_startup.append(init_dispatcher)
        app.on_startup.append(init_db)

        if skip_db_checks:
            logger.info("Skipping database checks.")
        else:
            app.on_startup.append(init_check_db)

        app.on_startup.append(init_resources)

        if not disable_job_manager:
            app.on_startup.append(init_job_manager)

        if not disable_file_manager:
            app.on_startup.append(init_file_manager)

        if not disable_refreshing:
            app.on_startup.append(init_refresh)

        app.on_shutdown.append(on_shutdown)

    return app


def create_events():
    return {
        "restart": asyncio.Event(),
        "shutdown": asyncio.Event()
    }


async def wait_for_restart(runner, events):
    await events["restart"].wait()
    await asyncio.sleep(0.5)
    await runner.cleanup()

    exe = sys.executable

    if exe.endswith("python") or "python3" in exe:
        return os.execl(exe, exe, *sys.argv)

    if exe.endswith("run"):
        return os.execv(exe, sys.argv)

    raise SystemError("Could not determine executable type")


async def wait_for_shutdown(runner, events):
    await events["shutdown"].wait()
    await asyncio.sleep(0.5)
    await runner.cleanup()


async def create_runner(app, host, port):
    runner = web.AppRunner(app)

    await runner.setup()

    site = web.TCPSite(runner, host, port)

    await site.start()

    logger.info(f"Listening at http://{host}:{port}")

    return runner


async def run(loop, host, port, skip_setup=False, force_version=None, no_sentry=False):
    app = create_app(
        loop,
        skip_setup=skip_setup,
        force_version=force_version,
        no_sentry=no_sentry
    )

    events = create_events()

    loop.add_signal_handler(signal.SIGINT, events["shutdown"].set)
    loop.add_signal_handler(signal.SIGTERM, events["shutdown"].set)

    app["events"] = events

    runner = await create_runner(app, host, port)

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
