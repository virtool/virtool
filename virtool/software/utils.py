import logging
import os
import shutil
import sys
from typing import List

import semver

logger = logging.getLogger(__name__)

INSTALL_PATH = sys.path[0]

SOFTWARE_REPO = "virtool/virtool"

RELEASE_KEYS = [
    "name",
    "body",
    "prerelease",
    "published_at",
    "html_url"
]


def check_software_files(path):
    if not {"client", "run", "VERSION"}.issubset(set(os.listdir(path))):
        return False

    client_content = os.listdir(os.path.join(path, "client"))

    if "favicon.ico" not in client_content or "index.html" not in client_content:
        return False

    if not any(["app." in filename and ".js" in filename for filename in client_content]):
        return False

    return True


def copy_software_files(src, dest):
    for dir_name in ["templates", "lib", "client", "assets"]:
        shutil.rmtree(os.path.join(dest, dir_name), ignore_errors=True)

    for name in os.listdir(src):
        src_path = os.path.join(src, name)
        dest_path = os.path.join(dest, name)

        if os.path.isfile(dest_path):
            os.remove(dest_path)

        if os.path.isfile(src_path):
            shutil.copy(src_path, dest_path)

        if os.path.isdir(dest_path):
            shutil.rmtree(dest_path)

        if os.path.isdir(src_path):
            shutil.copytree(src_path, dest_path)


def filter_releases_by_channel(releases: List[dict], channel: str):
    """
    Filter releases by channel (stable, beta, or alpha).

    :param releases: a list of releases
    :param channel: a software channel (
    :return: a filtered list of releases

    """
    if channel not in ["stable", "beta", "alpha"]:
        raise ValueError("Channel must be one of 'stable', 'beta', 'alpha'")

    if channel == "stable":
        return [r for r in releases if "alpha" not in r["name"] and "beta" not in r["name"]]

    elif channel == "beta":
        return [r for r in releases if "alpha" not in r["name"]]

    return list(releases)


def filter_releases_by_newer(releases: List[dict], version: str) -> List[dict]:
    """
    Returns a list containing only releases with versions later than the passed `version`.

    The passed `releases` are assumed to be sorted by descending version.

    :param releases: a list of releases
    :param version: the version the returned releases must be later than
    :return: filtered releases

    """
    stripped = version.replace("v", "")

    newer = list()

    for release in releases:
        if semver.compare(release["name"].replace("v", ""), stripped.replace("v", "")) < 1:
            return newer

        newer.append(release)

    return newer
