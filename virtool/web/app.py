import os
import sys
import ssl
import logging
import subprocess
import concurrent.futures

from aiohttp import web
from motor import motor_asyncio

import virtool.jobs
import virtool.web.routes
import virtool.web.sessions
import virtool.web.dispatcher

from virtool.jobs import manager
from virtool.web.settings import Settings

logger = logging.getLogger(__name__)


async def init_db(app):
    app["db_name"] = app["db_name"] or app["settings"].get("db_name")
    app["db"] = motor_asyncio.AsyncIOMotorClient(io_loop=app.loop)[app["db_name"]]

    await app["db"].history.create_index("virus_id")


def init_thread_pool(app):
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    app.loop.set_default_executor(executor)
    app["executor"] = executor


async def init_settings(app):
    app["settings"] = Settings(app)
    await app["settings"].load()


async def init_dispatcher(app):
    app["dispatcher"] = virtool.web.dispatcher.Dispatcher()


async def init_job_manager(app):
    app["job_manager"] = manager.Manager(
        app["settings"],
        app["db"],
        app["dispatcher"].dispatch
    )


def create_app(loop, db_name=None):
    app = web.Application(loop=loop, middlewares=[virtool.web.sessions.middleware_factory])

    virtool.web.routes.setup_routes(app)

    app["db_name"] = db_name

    app.on_startup.append(init_thread_pool)
    app.on_startup.append(init_settings)
    app.on_startup.append(init_dispatcher)
    app.on_startup.append(init_db)

    return app


def configure_ssl(cert_path, key_path):
    ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ssl_ctx.load_cert_chain(cert_path, key_path)

    return ssl_ctx


def reload():
    exe = sys.executable

    if exe.endswith("python"):
        os.execl(exe, exe, *sys.argv)

    if exe.endswith("run"):
        os.execv(exe, sys.argv)

    raise SystemError("Could not determine executable type")


def shutdown(app, exit_code=0):
    """
    Shutdown the server by cancelling all jobs and calling :func:`sys.exit`.

    :param exit_code: the exit code to return.
    :type exit_code: int

    """
    logging.info("Shutting down")

    job_manager = app.get("job_manager")

    if job_manager:
        for job_id in job_manager.jobs_dict:
            job_manager.cancel(job_id)

    logging.info("Exiting")

    sys.exit(exit_code)


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
