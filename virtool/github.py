import datetime

import aiohttp
from structlog import get_logger

import virtool.utils
from virtool.errors import GitHubError
from virtool.types import Document

logger = get_logger("github")


def create_update_subdocument(
    release: dict,
    ready: bool,
    user_id: str,
    created_at: datetime.datetime | None = None,
) -> dict:
    update = {
        k: release[k]
        for k in release
        if k not in ("content_type", "download_url", "etag", "retrieved_at")
    }

    return {
        **update,
        "created_at": created_at or virtool.utils.timestamp(),
        "ready": ready,
        "user": {"id": user_id},
    }


def format_release(release: dict) -> dict:
    """Format a raw release record from GitHub into a release usable by Virtool.

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
        "content_type": asset["content_type"],
    }


def get_etag(release: Document | None) -> str | None:
    """Get the ETag from a release dict.

    Return `None` when the key is missing or the input is not a `dict`.

    :param release: a release
    :return: an ETag or `None`

    """
    try:
        return release["etag"]
    except (KeyError, TypeError):
        return None


async def get_release(
    session: aiohttp.ClientSession,
    slug: str,
    etag: str | None = None,
    release_id: str | None = "latest",
) -> dict | None:
    """GET data from a GitHub API url.

    :param session: the application HTTP client session
    :param slug: the slug for the GitHub repo
    :param etag: an ETag for the resource to be used with the `If-None-Match` header
    :param release_id: the id of the GitHub release to get

    :return: the latest release
    """
    url = f"https://api.github.com/repos/{slug}/releases/{release_id}"

    headers = {"Accept": "application/vnd.github.v3+json"}

    if etag:
        headers["If-None-Match"] = etag

    logger.info("making gitHub request", url=url)

    async with session.get(
        url,
        headers=headers,
    ) as resp:
        rate_limit_remaining = resp.headers.get("X-RateLimit-Remaining", "00")
        rate_limit = resp.headers.get("X-RateLimit-Limit", "00")

        if int(rate_limit) / int(rate_limit_remaining) > 2.0:
            logger.warning(
                "less than half of github rate limit remaining",
                remaining=rate_limit_remaining,
                limit=rate_limit,
            )

        if resp.status == 200:
            data = await resp.json()

            if len(data["assets"]) == 0:
                return None

            return dict(data, etag=resp.headers["etag"])

        if resp.status == 304:
            return None

        logger.warning(
            "Encountered error during GitHub request",
            http_status=resp.status,
            body=await resp.json(),
        )
        raise GitHubError("Encountered error {resp.status} {await resp.json()}")
