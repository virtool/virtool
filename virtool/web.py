import os
import sys
import logging
import subprocess
import virtool.routes
import virtool.sessions

from aiohttp import web
from motor import motor_asyncio

logger = logging.getLogger(__name__)


def create_app(loop, db_name="virtool"):
    app = web.Application(loop=loop, middlewares=[virtool.sessions.middleware_factory])

    app["db"] = motor_asyncio.AsyncIOMotorClient(io_loop=loop)[db_name]

    virtool.routes.setup_routes(app)

    return app


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
