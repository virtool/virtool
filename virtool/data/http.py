"""An HTTP client for the data layer."""

import asyncio
from collections.abc import Awaitable, Callable
from pathlib import Path

from aiohttp import ClientSession


class HTTPClientError(Exception): ...


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
    ):
        """Download the binary file ``url`` to the location specified by ``target_path``.

        :param url: the download URL for the release
        :param target: the path to write the downloaded file to.
        :param progress_handler: a callable that will be called with the current
                                 progress when it changes.

        """
        async with self._session.get(url) as resp:
            if resp.status > 399:
                raise HTTPClientError

            q: asyncio.Queue[bytes | None] = asyncio.Queue()

            write_task = asyncio.create_task(
                asyncio.to_thread(self._write_download, q, target),
            )

            async for chunk in resp.content.iter_chunked(DOWNLOAD_CHUNK_SIZE):
                await q.put(chunk)

                if progress_handler:
                    await progress_handler(len(chunk))

            await q.put(None)
            await q.join()
            await write_task

            return

    def _write_download(self, q: asyncio.Queue, target: Path):
        try:
            with open(target, "wb") as handle:
                while True:
                    try:
                        chunk = q.get_nowait()
                    except asyncio.QueueEmpty:
                        continue

                    if chunk is not None:
                        handle.write(chunk)
                        q.task_done()
                        continue

                    q.task_done()
                    break

        except Exception:
            if target.exists():
                target.unlink()
            raise


async def download_file(
    url: str,
    target_path: Path,
    progress_handler: Callable[[float | int], Awaitable[int]] | None = None,
):
    """Download the binary file ``url`` to the location specified by ``target_path``.

    :param url: the download URL for the release
    :param target_path: the path to write the downloaded file to.
    :param progress_handler: a callable that will be called with the current progress
        when it changes.

    """
    async with ClientSession() as session, session.get(url) as resp:
        await HTTPClient(session).download(url, target_path, progress_handler)
