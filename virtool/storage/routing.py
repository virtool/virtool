"""Fallback storage router that tries a primary backend before a fallback."""

import asyncio
from collections.abc import AsyncIterator

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.storage.types import StorageObjectInfo


class FallbackStorageRouter:
    """Routes storage operations between a primary and a fallback backend.

    Reads probe the primary with ``size`` first and only fall back when that
    probe raises :class:`~virtool.storage.errors.StorageKeyNotFoundError`. Any
    other primary failure (permissions, network) propagates without touching
    the fallback, so a misconfigured primary cannot silently serve a stale
    fallback copy. Writes drain the
    fallback first, then write to the primary, so a stale fallback copy is
    never silently served after a primary write attempt — whether it succeeds
    or fails. Deletes always attempt both backends, even if one raises, so a
    failure on one side cannot leave an orphan on the other; failures are
    surfaced as a ``BaseExceptionGroup`` when both sides raise. List merges
    and deduplicates results, with primary metadata taking precedence.
    """

    def __init__(
        self,
        primary: StorageBackend,
        fallback: StorageBackend,
    ) -> None:
        self._primary = primary
        self._fallback = fallback

    async def read(self, key: str) -> AsyncIterator[bytes]:
        try:
            await self._primary.size(key)
        except StorageKeyNotFoundError:
            async for chunk in self._fallback.read(key):
                yield chunk
            return

        async for chunk in self._primary.read(key):
            yield chunk

    async def write(self, key: str, data: AsyncIterator[bytes]) -> int:
        await self._fallback.delete(key)
        return await self._primary.write(key, data)

    async def delete(self, key: str) -> None:
        primary_result, fallback_result = await asyncio.gather(
            self._primary.delete(key),
            self._fallback.delete(key),
            return_exceptions=True,
        )

        errors = [
            exc
            for exc in (primary_result, fallback_result)
            if isinstance(exc, BaseException)
        ]

        if len(errors) == 2:
            raise BaseExceptionGroup(
                f"delete failed on both backends for {key!r}",
                errors,
            )
        if errors:
            raise errors[0]

    async def size(self, key: str) -> int:
        try:
            return await self._primary.size(key)
        except StorageKeyNotFoundError:
            return await self._fallback.size(key)

    async def list(self, prefix: str) -> AsyncIterator[StorageObjectInfo]:
        seen: set[str] = set()

        async for info in self._primary.list(prefix):
            seen.add(info.key)
            yield info

        async for info in self._fallback.list(prefix):
            if info.key not in seen:
                yield info
