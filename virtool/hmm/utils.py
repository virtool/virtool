from semver import VersionInfo


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
