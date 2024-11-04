from pathlib import Path

from structlog import get_logger

logger = get_logger("app")


def determine_server_version():
    """Get from the server version from the installation directory

    :param install_path: the absolute path to the root virtool directory
    :return: the application version
    """
    try:
        with open(Path.cwd() / "VERSION") as version_file:
            return (version_file.read()).rstrip()
    except FileNotFoundError:
        logger.warning("could not determine software version.")
        return "Unknown"


def get_version_from_app(app) -> str:
    """Get the server version from the application object.

    :param app: the application object
    :return: the application version
    """
    return app["version"]
