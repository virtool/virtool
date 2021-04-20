from pathlib import Path

import semver
import virtool.github


def format_hmm_release(updated: dict, release: dict, installed: dict) -> dict:
    # The release dict will only be replaced if there is a 200 response from GitHub. A 304 indicates the release
    # has not changed and `None` is returned from `get_release()`.
    if updated is None:
        return None

    formatted = virtool.github.format_release(updated)

    formatted["newer"] = bool(
        release is None or installed is None or (
                installed and
                semver.compare(formatted["name"].lstrip("v"), installed["name"].lstrip("v")) == 1
        )
    )

    return formatted


def hmm_data_exists(file_path: Path) -> bool:
    """
    Checks if HMM data exists in the local data path.

    :param file_path: Path to where `profiles.hmm` should be
    :return: True if both the `hmm` directory and `profiles.hmm` exist, else False
    """
    return file_path.parent.is_dir() and file_path.is_file()
