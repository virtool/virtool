import asyncio
from dataclasses import dataclass
from pathlib import Path


class ChunkWriter:
    """Writes chunks of data to a file at a given path.

    This class is intended to be used as an asynchronous context manager. It writes the
    file in a separate thread to avoid blocking the event loop. Callers of this class
    are usually handling downloads or uploads of large files.

    We previously used `aiofiles` for this purpose, but it has a major performance cost.

    """

    def __init__(self, path: Path):
        self.path = path

        self._q: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._task = asyncio.create_task(
            asyncio.to_thread(self._write_chunks),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self._q.put_nowait(None)
        await self._q.join()
        await self._task

    async def write(self, chunk: bytes):
        """Write a chunk of data to the file.

        :param chunk: the data to write
        """
        await self._q.put(chunk)

    def _write_chunks(self):
        try:
            with open(self.path, "wb") as handle:
                while True:
                    try:
                        chunk = self._q.get_nowait()
                    except asyncio.QueueEmpty:
                        continue

                    if chunk is not None:
                        handle.write(chunk)
                        self._q.task_done()
                        continue

                    self._q.task_done()
                    break

        except Exception:
            self.path.unlink(missing_ok=True)
            raise


@dataclass
class FileDescriptor:
    """Describes a file in the Virtool application data directory."""

    #: The path to the file in the application data directory.
    path: Path

    #: The file size in bytes.
    size: int
