from semver import VersionInfo

import virtool.github


def format_hmm_release(
    updated: dict | None,
    release: dict,
    installed: dict,
) -> dict | None:
    """Format a HMM release for display in the client.

    The release dict will only be replaced if there is a 200 response from GitHub. A
    304 indicates the release has not changed and `None` is returned from
    `get_release()`.

    """
    if updated is None:
        return None

    formatted = virtool.github.format_release(updated)

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
