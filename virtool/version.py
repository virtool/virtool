from pathlib import Path
from typing import Optional

import aiofiles
from structlog import get_logger

logger = get_logger("app")


async def determine_server_version(install_path: Optional[Path] = Path.cwd()):
    """
        Get from the server version from the installation directory

        :param install_path: the absolute path to the root virtool directory
        :return: the application version
    """
    try:
        async with aiofiles.open(install_path / "VERSION", "r") as version_file:
            return (await version_file.read()).rstrip()
    except FileNotFoundError:
        logger.warning("Could not determine software version.")
        return "Unknown"


def get_version_from_app(app) -> str:
    """
    Get the server version from the application object.

    :param app: the application object
    :return: the application version
    """
    return app["version"]
