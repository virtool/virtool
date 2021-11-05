from pathlib import Path
from typing import Callable, Union, Awaitable

import aiofiles
from aiohttp.web_response import Response

from virtool.errors import GitHubError
from virtool.http.proxy import ProxyRequest
from virtool.types import App


async def download_file(
        app: App,
        url: str,
        target_path: Path,
        progress_handler: Callable[[Union[float, int]], Awaitable[int]] = None
):
    """
    Download the GitHub release at ``url`` to the location specified by ``target_path``.

    :param app: the app object
    :param url: the download URL for the release
    :param target_path: the path to write the downloaded file to.
    :param progress_handler: a callable that will be called with the current progress when it changes.

    """
    async with ProxyRequest(app["config"], app["client"].get, url) as resp:
        if resp.status != 200:
            raise GitHubError("Could not download file")

        async with aiofiles.open(target_path, "wb") as handle:
            while True:
                chunk = await resp.content.read(4096)

                if not chunk:
                    break

                await handle.write(chunk)

                if progress_handler:
                    await progress_handler(len(chunk))


def set_session_id_cookie(resp: Response, session_id: str):
    resp.set_cookie("session_id", session_id, httponly=True, max_age=2600000)


def set_session_token_cookie(resp: Response, session_token: str):
    resp.set_cookie("session_token", session_token, httponly=True, max_age=2600000)
