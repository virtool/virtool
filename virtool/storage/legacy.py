"""Legacy on-disk path translation for the filesystem fallback.

The new index storage key is ``indexes/{index_id}/{filename}``, but legacy
on-disk files live at ``{data_path}/references/{ref_id}/{index_id}/{filename}``.
This adapter wraps the fallback :class:`FilesystemProvider` and translates
``indexes/`` keys into the legacy layout so the migration can find them. The
mapping ``index_id -> ref_id`` is discovered by walking
``{data_path}/references/*`` once per ``index_id`` and cached in memory.

The adapter exists only to serve legacy on-disk files during the
object-storage migration. When the filesystem fallback is removed, delete
this module and unwire it from :mod:`virtool.storage.factory`.
"""

import asyncio
import re
from collections.abc import AsyncIterator
from pathlib import Path

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.storage.types import StorageObjectInfo

_INDEX_KEY_RE = re.compile(r"^indexes/(?P<index_id>[^/]+)(?P<rest>/.*)?$")


class LegacyIndexFilesystemAdapter:
    """Rewrites ``indexes/{index_id}/...`` keys to the legacy on-disk layout.

    Wraps a :class:`StorageBackend` (the fallback :class:`FilesystemProvider`)
    and resolves ``index_id`` to its parent ``ref_id`` by scanning
    ``{data_path}/references/*``. Non-index keys pass through unchanged. When
    no matching ``references/*/{index_id}`` directory exists on disk, reads
    raise :class:`StorageKeyNotFoundError`, deletes are no-ops, and lists
    yield nothing — matching the behaviour of a key that has never been
    written.
    """

    def __init__(self, inner: StorageBackend, data_path: Path) -> None:
        self._inner = inner
        self._references_path = (data_path / "references").resolve()
        self._cache: dict[str, str | None] = {}

    async def _resolve_ref_id(self, index_id: str) -> str | None:
        if index_id in self._cache:
            return self._cache[index_id]

        def _scan() -> str | None:
            if not self._references_path.is_dir():
                return None

            for ref_dir in self._references_path.iterdir():
                if (ref_dir / index_id).is_dir():
                    return ref_dir.name

            return None

        ref_id = await asyncio.to_thread(_scan)
        self._cache[index_id] = ref_id
        return ref_id

    async def _translate(self, key: str) -> str | None:
        """Translate an index key to the legacy on-disk layout.

        Returns the translated key, the original key when no translation
        applies, or ``None`` when the index_id cannot be resolved on disk.
        """
        match = _INDEX_KEY_RE.match(key)
        if match is None:
            return key

        index_id = match.group("index_id")
        rest = match.group("rest") or ""

        ref_id = await self._resolve_ref_id(index_id)
        if ref_id is None:
            return None

        return f"references/{ref_id}/{index_id}{rest}"

    async def read(self, key: str) -> AsyncIterator[bytes]:
        translated = await self._translate(key)
        if translated is None:
            raise StorageKeyNotFoundError(key)

        async for chunk in self._inner.read(translated):
            yield chunk

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        translated = await self._translate(key)
        if translated is None:
            return await self._inner.write(key, data)
        return await self._inner.write(translated, data)

    async def delete(self, key: str) -> None:
        translated = await self._translate(key)
        if translated is None:
            return
        await self._inner.delete(translated)

    async def size(self, key: str) -> int:
        translated = await self._translate(key)
        if translated is None:
            raise StorageKeyNotFoundError(key)
        return await self._inner.size(translated)

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        match = _INDEX_KEY_RE.match(prefix)
        if match is None:
            async for info in self._inner.list(prefix):
                yield info
            return

        index_id = match.group("index_id")
        rest = match.group("rest") or ""

        ref_id = await self._resolve_ref_id(index_id)
        if ref_id is None:
            return

        translated_prefix = f"references/{ref_id}/{index_id}{rest}"
        translated_root = f"references/{ref_id}/{index_id}/"
        index_root = f"indexes/{index_id}/"

        async for info in self._inner.list(translated_prefix):
            yield StorageObjectInfo(
                key=index_root + info.key.removeprefix(translated_root),
                size=info.size,
                last_modified=info.last_modified,
            )
