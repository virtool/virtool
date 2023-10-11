import asyncio
import subprocess
from pathlib import Path
from typing import Optional

import aiofiles
from structlog import get_logger

logger = get_logger("app")


async def determine_server_version(install_path: Optional[Path] = Path.cwd()):
    version = await asyncio.get_event_loop().run_in_executor(
        None, determine_server_version_from_git
    )

    if version:
        return version

    try:
        async with aiofiles.open(install_path / "VERSION", "r") as version_file:
            return (await version_file.read()).rstrip()
    except FileNotFoundError:
        logger.warning("Could not determine software version.")
        return "Unknown"


def determine_server_version_from_git():
    try:
        command = ["git", "describe", "--tags"]

        output = subprocess.check_output(command, stderr=subprocess.STDOUT)

        output = output.decode().rstrip()

        if not output or "Not a git repository" in output:
            return None

        return output
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    return None


def get_version_from_app(app) -> str:
    """
    Get the server version from the application object.

    :param app: the application object
    :return: the application version
    """
    return app["version"]
