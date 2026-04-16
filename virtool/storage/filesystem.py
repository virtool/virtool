"""Storage backend implementation using the local filesystem."""

import asyncio
import os
import tempfile
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.protocol import STORAGE_CHUNK_SIZE
from virtool.storage.types import StorageObjectInfo


class FilesystemProvider:
    """StorageBackend implementation backed by the local filesystem.

    Translates storage keys to paths under a base directory. All blocking I/O
    is offloaded via ``asyncio.to_thread``.
    """

    def __init__(self, base_path: Path) -> None:
        self._base_path = base_path.resolve()

    async def _resolve(self, key: str) -> Path:
        """Map a storage key to an absolute path under the base directory."""
        path = await asyncio.to_thread(lambda: (self._base_path / key).resolve())

        if not path.is_relative_to(self._base_path):
            msg = f"Key {key!r} resolves outside the base path"
            raise StorageError(msg)

        return path

    async def read(self, key: str) -> AsyncIterator[bytes]:
        """Stream the contents of the object at ``key`` as chunks of bytes."""
        path = await self._resolve(key)

        if not await asyncio.to_thread(path.is_file):
            raise StorageKeyNotFoundError(key)

        f = await asyncio.to_thread(open, path, "rb")
        try:
            while True:
                chunk = await asyncio.to_thread(f.read, STORAGE_CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        finally:
            await asyncio.to_thread(f.close)

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        """Write streamed data to the object at ``key``.

        Uses a temporary file and atomic rename to prevent partial writes.
        """
        path = await self._resolve(key)
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)

        tmp_fd = await asyncio.to_thread(
            tempfile.NamedTemporaryFile,
            dir=path.parent,
            delete=False,
        )
        tmp_path = Path(tmp_fd.name)
        size = 0

        try:
            async for chunk in data:
                await asyncio.to_thread(tmp_fd.write, chunk)
                size += len(chunk)
            await asyncio.to_thread(tmp_fd.close)
            await asyncio.to_thread(os.replace, tmp_path, path)
        except BaseException:
            await asyncio.to_thread(tmp_fd.close)
            await asyncio.to_thread(tmp_path.unlink, True)
            raise

        return size

    async def delete(self, key: str) -> None:
        """Delete the object at ``key``. Idempotent."""
        path = await self._resolve(key)
        await asyncio.to_thread(path.unlink, True)

        parent = path.parent
        while parent != self._base_path:
            try:
                await asyncio.to_thread(parent.rmdir)
            except OSError:
                break
            parent = parent.parent

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        """List objects whose keys start with ``prefix``."""

        def _walk():
            prefix_path = self._base_path / prefix

            if prefix_path.is_dir():
                search_dir = prefix_path
            elif prefix_path.parent.is_dir():
                search_dir = prefix_path.parent
            else:
                return []

            results = []

            for dirpath, _, filenames in os.walk(search_dir):
                for filename in filenames:
                    filepath = Path(dirpath) / filename
                    key = str(filepath.relative_to(self._base_path))

                    if key.startswith(prefix):
                        stat = filepath.stat()
                        results.append(
                            StorageObjectInfo(
                                key=key,
                                size=stat.st_size,
                                last_modified=datetime.fromtimestamp(
                                    stat.st_mtime,
                                    tz=UTC,
                                ),
                            ),
                        )

            return results

        items = await asyncio.to_thread(_walk)

        for item in items:
            yield item
