import tarfile

import aiofiles
import aiohttp

import virtool.errors
import virtool.http.proxy


def get_headers(server_version):
    """
    Return a dict of GitHub-specific headers based on the passed ``server_version``.

    :param server_version: the running server version

    :return: a headers dict
    :rtype: dict

    """
    return {
        "user-agent": "virtool/{}".format(server_version),
        "Accept": "application/vnd.github.v3+json"
    }


def create_auth(username, token):
    if username is not None and token is not None:
        return aiohttp.BasicAuth(login=username, password=token)

    return None


async def get(settings, url, server_version, username, token):
    """
    GET data from a GitHub API url.

    :param url: the url
    :type url: str

    :param server_version: the current server version used to build the request header
    :type server_version: str

    :param username: an optional username to use for authentication
    :type username: str

    :param token: an optional GitHub personal token to use for auth
    :type token: str

    :return:
    """
    headers = get_headers(server_version)

    auth = create_auth(username, token)

    async with aiohttp.ClientSession(auth=auth) as session:
        async with virtool.http.proxy.ProxyRequest(settings, session.get, url, headers=headers) as resp:
            if resp.status != 200:
                raise virtool.errors.GitHubError("Encountered error {}".format(resp.status))

            return await resp.json()


async def download_asset(settings, url, size, target_path, progress_handler=None):
    """
    Download the GitHub release at ``url`` to the location specified by ``target_path``.

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param url: the download URL for the release
    :type url str

    :param size: the size in bytes of the file to be downloaded.
    :type size: int

    :param target_path: the path to write the downloaded file to.
    :type target_path: str

    :param progress_handler: a callable that will be called with the current progress when it changes.
    :type progress_handler: Callable[[Union[float, int]]]

    """
    counter = 0
    last_reported = 0

    async with aiohttp.ClientSession() as session:
        async with virtool.http.proxy.ProxyRequest(settings, session.get, url) as resp:
            if resp.status != 200:
                raise virtool.errors.GitHubError("Could not download release asset")

            async with aiofiles.open(target_path, "wb") as handle:
                while True:
                    chunk = await resp.content.read(4096)

                    if not chunk:
                        break

                    await handle.write(chunk)

                    if progress_handler:
                        counter += len(chunk)
                        progress = round(counter / size, 2)

                        if progress - last_reported >= 0.01:
                            last_reported = progress
                            await progress_handler(progress)


def decompress_asset_file(path, target):
    """
    Decompress the tar.gz file at ``path`` to the directory ``target``.

    :param path: the path to the tar.gz file.
    :type path: str

    :param target: the path to directory into which to decompress the tar.gz file.
    :type target: str

    """
    with tarfile.open(path, "r:gz") as tar:
        tar.extractall(target)
