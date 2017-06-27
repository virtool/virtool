import os
import sys
import ssl
import asyncio
import logging
import subprocess
import concurrent.futures

from aiohttp import web
from motor import motor_asyncio

import virtool.app_routes
import virtool.app_dispatcher
import virtool.app_settings
import virtool.job_manager
import virtool.job_resources
import virtool.file_manager
import virtool.organize
import virtool.user_sessions
import virtool.error_pages


logger = logging.getLogger(__name__)


def init_thread_pool_executor(app):
    """
    An application ``on_startup`` callback that initializes a :class:`~ThreadPoolExecutor` and attaches it to the
    ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    app.loop.set_default_executor(executor)
    app["executor"] = executor


def init_resources(app):
    app["resources"] = virtool.job_resources.get()
    app["resources"]["cuda"] = virtool.job_resources.get_cuda_devices()


async def init_settings(app):
    """
    An application ``on_startup`` callback that initializes a Virtool :class:`~.Settings` object and attaches it to the
    ``app`` object.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    app["settings"] = virtool.app_settings.Settings(app.loop)
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

    app["db"] = motor_asyncio.AsyncIOMotorClient(io_loop=app.loop)[app["db_name"]]

    await virtool.organize.organize_subtraction(app["db"])

    await app["db"].viruses.create_index("name")
    await app["db"].viruses.create_index("abbreviation")
    await app["db"].viruses.create_index("modified")
    await app["db"].indexes.create_index("index_version", unique=True)
    await app["db"].history.create_index("virus_id")
    await app["db"].history.create_index("index_id")


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


async def init_file_manager(app):
    data_path = os.path.join(app["settings"].get("data_path"), "files")

    app["file_manager"] = virtool.file_manager.Manager(
        app.loop,
        app["db"],
        app["dispatcher"].dispatch,
        data_path,
        clean_interval=20
    )

    await app["file_manager"].start()


async def on_shutdown(app):
    """
    A function called when the app is shutting down.
    
    :param app: the Virtool application 
    :type app: :class:`aiohttp.web.Application`
    
    """
    for conn in app["dispatcher"].connections:
        await conn.close()
        app["dispatcher"].remove_connection(conn)

    job_manager = app["job_manager"]

    for job_id in job_manager:
        await job_manager.cancel(job_id)

    while job_manager:
        asyncio.sleep(0.1, loop=app.loop)

    await job_manager.close()

    await app["file_manager"].close()


def create_app(loop, db_name=None):
    """
    Creates the Virtool application.
    
    - creates an returns an instance of :class:`aiohttp.web.Application`
    - sets up URL routing
    - initializes all main Virtool objects during ``on_startup``
     
    """
    app = web.Application(loop=loop, middlewares=[
        virtool.error_pages.middleware_factory,
        virtool.user_sessions.middleware_factory
    ])

    virtool.app_routes.setup_routes(app)

    app["db_name"] = db_name

    app.on_startup.append(init_thread_pool_executor)
    app.on_startup.append(init_settings)
    app.on_startup.append(init_dispatcher)
    app.on_startup.append(init_db)
    app.on_startup.append(init_resources)
    app.on_startup.append(init_job_manager)
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


def reload():
    exe = sys.executable

    if exe.endswith("python") or "python3" in exe:
        os.execl(exe, exe, *sys.argv)

    if exe.endswith("run"):
        os.execv(exe, sys.argv)

    raise SystemError("Could not determine executable type")


def find_server_version(install_path="."):
    try:
        return subprocess.check_output(["git", "describe", "--tags"]).decode().rstrip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            version_file_path = os.path.join(install_path, "VERSION")

            with open(version_file_path, "r") as version_file:
                return version_file.read().rstrip()

        except FileNotFoundError:
            logger.critical("Could not determine software version.")
            return "Unknown"
