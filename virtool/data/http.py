"""An HTTP client for the data layer."""

from collections.abc import Awaitable, Callable
from http import HTTPStatus
from pathlib import Path

from aiohttp import ClientSession

from virtool.data.file import ChunkWriter


class HTTPClientError(Exception):
    """Raised when the Virtool HTTPClient encounters an error."""


DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 4
"""The size of the chunks to download in bytes."""


class HTTPClient:
    """A client for making HTTP requests from the Virtool backend."""

    def __init__(self, session: ClientSession) -> None:
        """:param session: the aiohttp client session"""
        self._session = session

    async def download(
        self,
        url: str,
        target: Path,
        progress_handler: Callable[[float | int], Awaitable[int]] | None = None,
    ) -> None:
        """Download a binary file.

        :param url: the download URL for the release
        :param target: the path to write the downloaded file to.
        :param progress_handler: a callable that will be called with the current
                                 progress when it changes.
        """
        async with self._session.get(url) as resp:
            status = HTTPStatus(resp.status)

            if status.is_client_error or status.is_server_error:
                raise HTTPClientError

            async with ChunkWriter(target) as writer:
                async for chunk in resp.content.iter_chunked(DOWNLOAD_CHUNK_SIZE):
                    await writer.write(chunk)

                    if progress_handler:
                        await progress_handler(len(chunk))


async def download_file(
    url: str,
    target_path: Path,
    progress_handler: Callable[[float | int], Awaitable[int]] | None = None,
) -> None:
    """Download the binary file ``url`` to the location specified by ``target_path``.

    :param url: the download URL for the release
    :param target_path: the path to write the downloaded file to.
    :param progress_handler: a callable that will be called with the current progress
        when it changes.

    """
    async with ClientSession() as session, session.get(url) as resp:
        await HTTPClient(session).download(url, target_path, progress_handler)
