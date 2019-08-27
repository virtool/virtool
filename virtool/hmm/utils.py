import semver
import virtool.github


def format_hmm_release(updated, release, installed):
    # The release dict will only be replaced if there is a 200 response from GitHub. A 304 indicates the release
    # has not changed and `None` is returned from `get_release()`.
    if updated is None:
        return None

    formatted = virtool.github.format_release(release)

    formatted["newer"] = bool(
        release is None or installed is None or (
                installed and
                semver.compare(release["name"].lstrip("v"), installed["name"].lstrip("v")) == 1
        )
    )

    return formatted
