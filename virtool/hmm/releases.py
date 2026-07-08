"""Work with HMM release manifests published on www.virtool.ca."""

from enum import Enum

from aiohttp import ClientSession
from structlog import get_logger

logger = get_logger("releases")


class GetReleaseError(Exception):
    pass


class ReleaseType(str, Enum):
    """The types of releases that can be fetched from www.virtool.ca.

    The value of each member is used as part of the URL path to the release manifest.
    For example `HMMS` is used to construct a URL like
    `www.virtool.ca/releases/hmms.json`.

    """

    HMMS = "hmms"


async def fetch_release_manifest_from_virtool(
    session: ClientSession, release_type: ReleaseType
) -> dict | None:
    """Get releases of a single :class:``ReleaseType`` from www.virtool.ca/releases.

    :param session: the application HTTP client session
    :param release_type: the type of repository manifest to fetch
    :return: the releases of the requested repository
    """
    url = f"https://www.virtool.ca/releases/{release_type.value}.json"

    try:
        async with session.get(url) as resp:
            if resp.status == 200:
                return await resp.json(content_type=None)

            if resp.status == 304:
                return None

            raise GetReleaseError("release does not exist")
    except TimeoutError:
        logger.warning(
            "timeout fetching release manifest from virtool.ca",
            url=url,
            release_type=release_type.value,
        )
        return None
