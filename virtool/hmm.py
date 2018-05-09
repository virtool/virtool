import os

import virtool.errors
import virtool.github
import virtool.updates
import virtool.utils

LATEST_RELEASE_URL = "https://api.github.com/repos/virtool/virtool-hmm/releases/latest"


def file_exists(data_path):
    return os.path.isfile(os.path.join(data_path, "hmm", "profiles.hmm"))


async def get_asset(settings, server_version, username, token):
    """
    Get the asset information associated with the latest HMM release.

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param server_version: the current server version
    :type server_version: str

    :param username: the GitHub username to use for auth
    :type username: str

    :param token: the GitHub token to use for auth
    :type  token: str

    :return: the assets, a dict containing the download url and size in a tuple
    :rtype: Coroutine[dict]

    """
    release = await virtool.github.get(settings, LATEST_RELEASE_URL, server_version, username, token)

    assets = list()

    for asset in release["assets"]:
        assets.append((asset["browser_download_url"], asset["size"]))

    return assets
