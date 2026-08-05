"""Best-effort cleanup helpers for orphaned storage objects."""

import asyncio
from collections.abc import Iterable

from virtool.storage.protocol import StorageBackend


async def delete_keys(
    storage: StorageBackend,
    keys: Iterable[str],
) -> list[tuple[str, BaseException]]:
    """Best-effort delete every object named by ``keys``.

    Attempts every delete concurrently and never raises: when this runs the
    caller has typically already committed a database write that makes these
    objects orphans, so propagating one failure would skip the rest of the
    cleanup while telling the API client the whole operation failed.

    Callers pass the keys recorded on the rows they are deleting, which must be
    read before those rows go, and only objects named by a row are removed.
    Objects written before keys were recorded are not reachable this way and are
    left for a separate sweep.

    Returns a list of ``(key, exception)`` pairs for failures. Callers must log
    these so orphans remain observable.
    """
    keys = list(keys)

    results = await asyncio.gather(
        *(storage.delete(key) for key in keys),
        return_exceptions=True,
    )

    return [
        (key, result)
        for key, result in zip(keys, results, strict=True)
        if isinstance(result, BaseException)
    ]
