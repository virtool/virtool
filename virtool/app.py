import aiofiles
import concurrent.futures
import logging
import os
import pymongo
import ssl
import sys
import subprocess

from aiohttp import web
from motor import motor_asyncio

import virtool.app_auth
import virtool.app_dispatcher
import virtool.app_routes
import virtool.app_settings
import virtool.job_manager
import virtool.job_resources
import virtool.error_pages
import virtool.file_manager
import virtool.organize
import virtool.setup
import virtool.utils


logger = logging.getLogger(__name__)


def init_executors(app):
    """
    An application ``on_startup`` callback that initializes a :class:`~ThreadPoolExecutor` and attaches it to the
    ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    app.loop.set_default_executor(executor)
    app["executor"] = executor

    executor = concurrent.futures.ProcessPoolExecutor()
    app["process_executor"] = executor


def init_resources(app):
    app["resources"] = virtool.job_resources.get()


async def init_settings(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Settings` object and attaches it to the
    ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["settings"] = virtool.app_settings.Settings()
    await app["settings"].load()


def init_dispatcher(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Dispatcher` object and attaches it to
    the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["dispatcher"] = virtool.app_dispatcher.Dispatcher()


async def init_db(app):
    """
    An application ``on_startup`` callback that attaches an instance of :class:`~AsyncIOMotorClient` and the ``db_name``
    to the Virtool ``app`` object. Also initializes collection indices.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["db_name"] = app.get("db_name", None) or app["settings"].get("db_name")

    db = motor_asyncio.AsyncIOMotorClient(io_loop=app.loop)[app["db_name"]]

    logger.info("Starting database checks. Do not interrupt. This may take several minutes.")

    logger.info("Checking viruses...")
    await virtool.organize.organize_viruses(db, logger.info)

    logger.info("Checking jobs...")
    await virtool.organize.organize_jobs(db)

    logger.info("Checking samples...")
    await virtool.organize.organize_samples(db, app["settings"])

    logger.info("Checking analyses...")
    await virtool.organize.organize_analyses(db, logger.info)

    logger.info("Checking indexes...")
    await virtool.organize.organize_indexes(db)

    logger.info("Checking subtraction...")
    await virtool.organize.organize_subtraction(db, app["settings"])

    logger.info("Checking groups...")
    await virtool.organize.organize_groups(db)

    logger.info("Checking users...")
    await virtool.organize.organize_users(db)

    logger.info("Checking status...")
    await virtool.organize.organize_status(db)

    logger.info("Creating database indexes...")

    await db.analyses.create_index("sample.id")
    await db.history.create_index("virus.id")
    await db.history.create_index("index.id")
    await db.history.create_index("created_at")
    await db.indexes.create_index("version", unique=True)
    await db.keys.create_index("id", unique=True)
    await db.keys.create_index("user.id")
    await db.samples.create_index([("created_at", pymongo.DESCENDING)])
    await db.sequences.create_index("virus_id")
    await db.viruses.create_index("name")
    await db.viruses.create_index("abbreviation")

    app["db"] = db


async def init_job_manager(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`virtool.job_manager.Manager` object and
    attaches it to the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["job_manager"] = virtool.job_manager.Manager(
        app.loop,
        app["db"],
        app["settings"],
        app["dispatcher"].dispatch
    )

    app["job_manager"].start()


async def init_file_manager(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`virtool.file_manager.Manager` object and
    attaches it to the ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    files_path = os.path.join(app["settings"].get("data_path"), "files")

    if os.path.isdir(files_path):
        app["file_manager"] = virtool.file_manager.Manager(
            app.loop,
            app["executor"],
            app["db"],
            app["dispatcher"].dispatch,
            files_path,
            app["settings"].get("watch_path"),
            clean_interval=20
        )

        await app["file_manager"].start()
    else:
        logger.warning("Did not initialize file manager. Path does not exist: {}".format(files_path))
        app["file_manager"] = None


def init_setup(app):
    app["setup"] = {
        "db_host": None,
        "db_port": None,
        "db_name": None,

        "first_user_id": None,
        "first_user_password": None,

        "data_path": None,
        "watch_path": None,

        "errors": {
            "db_exists_error": False,
            "db_connection_error": False,
            "password_confirmation_error": False,
            "data_not_empty_error": False,
            "data_not_found_error": False,
            "data_permission_error": False,
            "watch_not_empty_error": False,
            "watch_not_found_error": False,
            "watch_permission_error": False
        }
    }


async def on_shutdown(app):
    """
    A function called when the app is shutting down.

    :param app: the Virtool application
    :type app: :class:`aiohttp.web.Application`

    """
    for conn in app["dispatcher"].connections:
        await conn.close()
        app["dispatcher"].remove_connection(conn)

    if "job_manager" in app:
        job_manager = app["job_manager"]

        await job_manager.close()

    file_manager = app.get("file_manager", None)

    if file_manager is not None:
        await file_manager.close()


def create_app(loop, db_name=None, disable_job_manager=False, disable_file_manager=False, skip_setup=False):
    """
    Creates the Virtool application.

    - creates an returns an instance of :class:`aiohttp.web.Application`
    - sets up URL routing
    - initializes all main Virtool objects during ``on_startup``

    """
    middlewares = [
        virtool.error_pages.middleware_factory
    ]

    if skip_setup:
        middlewares.append(virtool.app_auth.middleware_factory)

    app = web.Application(loop=loop, middlewares=middlewares)

    app["db_name"] = db_name

    for client_path in [os.path.join(sys.path[0], "client"), os.path.join(sys.path[0], "client", "dist")]:
        if os.path.exists(os.path.join(client_path, "index.html")):
            app["client_path"] = client_path
            break

    if "client_path" not in app:
        raise FileNotFoundError("Could not find client path")

    app.on_startup.append(init_settings)

    if not skip_setup:
        virtool.setup.setup_routes(app)
        app.on_startup.append(init_setup)
    else:
        virtool.app_routes.setup_routes(app)

        app.on_startup.append(init_executors)
        app.on_startup.append(init_dispatcher)
        app.on_startup.append(init_db)
        app.on_startup.append(init_resources)

        if not disable_job_manager:
            app.on_startup.append(init_job_manager)

        if not disable_file_manager:
            app.on_startup.append(init_file_manager)

        app.on_shutdown.append(on_shutdown)

    return app


def configure_ssl(cert_path, key_path):
    """
    Return an SSL context given the paths to a certificate file and key file.

    :param cert_path: the certificate path
    :type cert_path: str

    :param key_path: the key path
    :type key_path: str

    :return: an SSL context
    :rtype: :class:`ssl.SSLContext`

    """
    ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ssl_ctx.load_cert_chain(cert_path, keyfile=key_path)

    return ssl_ctx


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
