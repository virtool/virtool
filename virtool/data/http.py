"""
An HTTP client for the data layer.

"""
from pathlib import Path
from typing import Callable, Union, Awaitable

import aiofiles
from aiohttp import ClientSession

from virtool.errors import WebError


class HTTPClientError(Exception):
    ...


class HTTPClient:
    """A client for making HTTP requests from the Virtool backend."""

    def __init__(self, session: ClientSession) -> None:
        """
        :param session: the aiohttp client session
        """
        self._session = session

    async def download(self, url: str, target: Path, progress_handler=None):
        """
        Download the binary file ``url`` to the location specified by ``target_path``.

        :param url: the download URL for the release
        :param target: the path to write the downloaded file to.
        :param progress_handler: a callable that will be called with the current
                                 progress when it changes.

        """
        async with self._session.get(url) as resp:
            if resp.status > 399:
                raise HTTPClientError

            async with aiofiles.open(target, "wb") as handle:
                while True:
                    chunk = await resp.content.read(4096)

                    if not chunk:
                        break

                    await handle.write(chunk)

                    if progress_handler:
                        await progress_handler(len(chunk))


async def download_file(
    url: str,
    target_path: Path,
    progress_handler: Callable[[Union[float, int]], Awaitable[int]] | None = None,
):
    """
    Download the binary file ``url`` to the location specified by ``target_path``.

    :param url: the download URL for the release
    :param target_path: the path to write the downloaded file to.
    :param progress_handler: a callable that will be called with the current progress
        when it changes.

    """

    async with ClientSession() as session, session.get(url) as resp:
        if resp.status != 200:
            raise WebError

        async with aiofiles.open(target_path, "wb") as handle:
            while True:
                chunk = await resp.content.read(4096)

                if not chunk:
                    break

                await handle.write(chunk)

                if progress_handler:
                    await progress_handler(len(chunk))
