"""Work with release manifests published on www.virtool.ca."""

import datetime
from dataclasses import dataclass
from enum import Enum
from typing import TypeAlias

from aiohttp import ClientSession


@dataclass
class ReleaseManifestItem:
    """A single release manifest item."""

    id: int
    """The GitHub release ID."""

    body: str
    """
    The release notes from GitHub.

    This likely contains Markdown.
    """

    content_type: str
    """
    The MIME type of the release asset.

    This will likely be ``application/gzip``.
    """

    download_url: str
    """The URL to download the release asset from GitHub."""

    filename: str
    """The name of the release asset file."""

    html_url: str
    """The URL to view the release on GitHub."""

    name: str
    """The name of the release (eg. 1.1.0)."""

    prerelease: bool
    """
    Whether or not the release is a pre-release.

    This is sourced from the GitHub release record.
    """

    published_at: datetime.datetime
    """When the release was published on GitHub."""

    size: int
    """The size of the release asset in bytes."""


ReleaseManifest: TypeAlias = list[ReleaseManifestItem]
"""The list of releases returned in a JSON payload from www.virtool.ca/releases."""


class ReleaseType(str, Enum):
    """The types of releases that can be fetched from www.virtool.ca.

    The value of each member is used as part of the URL path to the release manifest.
    For example `REFERENCES` is used to construct a URL like
    `www.virtool.ca/releases/references.json`.

    """

    HMMS = "hmms"
    ML = "ml"
    REFERENCES = "references"


async def fetch_release_manifest_from_virtool(
    session: ClientSession,
    release_type: ReleaseType,
) -> dict | None:
    """Get releases of a single :class:``ReleaseType`` from www.virtool.ca/releases.

    :param session: the application HTTP client session
    :param release_type: the type of repository manifest to fetch
    :return: the releases of the requested repository
    """
    url = f"https://www.virtool.ca/releases/{release_type.value}.json"

    async with session.get(url) as resp:
        if resp.status == 200:
            return await resp.json(content_type=None)

        if resp.status == 304:
            return None

        raise GetReleaseError("release does not exist")


class GetReleaseError(Exception):
    pass
