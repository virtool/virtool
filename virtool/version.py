import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional

import aiofiles

logger = logging.getLogger("app")


async def determine_server_version(install_path: Optional[Path] = Path.cwd()):
    loop = asyncio.get_event_loop()

    version = await loop.run_in_executor(None, determine_server_version_from_git)

    if version:
        return version

    try:
        version_file_path = install_path / "VERSION"

        async with aiofiles.open(version_file_path, "r") as version_file:
            content = await version_file.read()
            return content.rstrip()

    except FileNotFoundError:
        logger.critical("Could not determine software version.")
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
