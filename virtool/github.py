import datetime
import logging
from typing import Optional

import aiohttp

import virtool.errors
import virtool.utils
from virtool.config.cls import Config
from virtool.http.proxy import ProxyRequest

logger = logging.getLogger(__name__)

BASE_URL = "https://api.github.com/repos"

EXCLUDED_UPDATE_FIELDS = (
    "content_type",
    "download_url",
    "etag",
    "retrieved_at"
)

HEADERS = {
    "Accept": "application/vnd.github.v3+json"
}


def create_update_subdocument(
        release: dict,
        ready: bool,
        user_id: str,
        created_at: Optional[datetime.datetime] = None
) -> dict:
    update = {k: release[k] for k in release if k not in EXCLUDED_UPDATE_FIELDS}

    return {
        **update,
        "created_at": created_at or virtool.utils.timestamp(),
        "ready": ready,
        "user": {
            "id": user_id
        }
    }


def format_release(release: dict) -> dict:
    """
    Format a raw release record from GitHub into a release usable by Virtool.

    :param release: the GitHub release record
    :return: a release for use within Virtool

    """
    asset = release["assets"][0]

    return {
        "id": release["id"],
        "name": release["name"],
        "body": release["body"],
        "etag": release["etag"],
        "filename": asset["name"],
        "size": asset["size"],
        "html_url": release["html_url"],
        "download_url": asset["browser_download_url"],
        "published_at": release["published_at"],
        "content_type": asset["content_type"]
    }


def get_etag(release: Optional[dict]) -> Optional[str]:
    """
    Get the ETag from a release dict. Return `None` when the key is missing or the input is not a `dict`.

    :param release: a release
    :return: an ETag or `None`

    """
    try:
        return release["etag"]
    except (KeyError, TypeError):
        return None


async def get_release(
        config: Config,
        session: aiohttp.ClientSession,
        slug: str,
        etag: Optional[str] = None,
        release_id: Optional[str] = "latest"
) -> Optional[dict]:
    """
    GET data from a GitHub API url.

    :param config: the application config object
    :param session: the application HTTP client session
    :param slug: the slug for the GitHub repo
    :param etag: an ETag for the resource to be used with the `If-None-Match` header
    :param release_id: the id of the GitHub release to get

    :return: the latest release
    """
    url = f"{BASE_URL}/{slug}/releases/{release_id}"

    headers = dict(HEADERS)

    if etag:
        headers["If-None-Match"] = etag

    logger.debug(f"Making GitHub request to {url}")

    async with ProxyRequest(config, session.get, url, headers=headers) as resp:        
        rate_limit_remaining = resp.headers.get("X-RateLimit-Remaining", "00")
        rate_limit = resp.headers.get("X-RateLimit-Limit", "00")

        if rate_limit / rate_limit_remaining < 2:
            logger.warning(f"Less than half of GitHub remaining ({rate_limit_remaining} of {rate_limit})")

        logger.debug(f"Fetched release: {slug}/{release_id} ({resp.status})")

        if resp.status == 200:
            data = await resp.json()

            if len(data["assets"]) == 0:
                return None

            return dict(data, etag=resp.headers["etag"])

        elif resp.status == 304:
            return None

        else:
            warning = f"Encountered error {resp.status} {await resp.json()}"
            logger.warning(warning)
            raise virtool.errors.GitHubError(warning)
