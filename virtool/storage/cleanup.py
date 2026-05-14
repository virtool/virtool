"""Best-effort cleanup helpers for orphaned storage objects."""

import asyncio

from virtool.storage.protocol import StorageBackend


async def delete_prefix(
    storage: StorageBackend,
    prefix: str,
) -> list[tuple[str, BaseException]]:
    """Best-effort delete every object under ``prefix``.

    Attempts every delete concurrently and never raises: when this runs the
    caller has typically already committed a database write that makes these
    objects orphans, so propagating one failure would skip the rest of the
    cleanup while telling the API client the whole operation failed.

    Returns a list of ``(key, exception)`` pairs for the deletes that raised.
    Callers must log these so orphans remain observable.
    """
    keys = [obj.key async for obj in storage.list(prefix)]

    results = await asyncio.gather(
        *(storage.delete(key) for key in keys),
        return_exceptions=True,
    )

    return [
        (key, result)
        for key, result in zip(keys, results, strict=True)
        if isinstance(result, BaseException)
    ]
