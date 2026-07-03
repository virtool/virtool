import datetime

from semver import VersionInfo

import virtool.utils


def create_update_subdocument(
    release: dict,
    ready: bool,
    user_id: int,
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


def format_hmm_release(
    updated: dict | None,
    release: dict,
    installed: dict,
) -> dict | None:
    """Format a HMM release from the www.virtool.ca manifest for the client.

    The release dict will only be replaced when a manifest item is passed. When the
    manifest could not be fetched, `None` is returned and the stored release is kept.

    """
    if updated is None:
        return None

    formatted = {
        "id": updated["id"],
        "name": updated["name"],
        "body": updated["body"],
        "filename": updated["filename"],
        "size": updated["size"],
        "html_url": updated["html_url"],
        "download_url": updated["download_url"],
        "published_at": updated["published_at"],
        "content_type": updated["content_type"],
    }

    formatted["newer"] = bool(
        release is None
        or installed is None
        or (
            installed
            and VersionInfo.parse(formatted["name"].lstrip("v"))
            > VersionInfo.parse(installed["name"].lstrip("v"))
        ),
    )

    return formatted
