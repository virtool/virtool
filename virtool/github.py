import aiofiles
import aiohttp

import virtool.errors


def get_headers(server_version):
    """
    Return a dict of GitHub-specific headers based on the passed ``server_version``.

    :param server_version: the running server version
    :type server_version: str

    :return: a headers dict
    :rtype: dict

    """
    return {
        "user-agent": "virtool/{}".format(server_version),
        "Accept": "application/vnd.github.v3+json"
    }


async def create_session(username, token):
    auth = None

    if token is not None:
        auth = aiohttp.BasicAuth(login=username, password=token)

    return aiohttp.ClientSession(auth=auth)


async def get(url, server_version, username, token):
    headers = get_headers(server_version)

    async with create_session(username, token) as session:
        async with session.get(url, headers=headers) as resp:
            return await resp.json()


async def download_asset(url, size, target_path, progress_handler=None):
    """
    Download the GitHub release at ``url`` to the location specified by ``target_path``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: a reference to the dispatcher's dispatch method
    :type dispatch: func

    :param url: the download URL for the release
    :type url str

    :param size: the size in bytes of the file to be downloaded.
    :type size: int

    :param target_path: the path to write the downloaded file to.
    :type target_path: str

    """
    counter = 0
    last_reported = 0

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:

            if resp.status != 200:
                raise virtool.errors.GitHubError("Could not download release asset")

            async with aiofiles.open(target_path, "wb") as handle:
                while True:
                    chunk = await resp.content.read(4096)

                    if not chunk:
                        break

                    await handle.write(chunk)

                    if handler:
                        counter += len(chunk)
                        progress = round(counter / size, 2)
                        if progress - last_reported >= 0.01:
                            last_reported = progress
                            await handler(progress)
