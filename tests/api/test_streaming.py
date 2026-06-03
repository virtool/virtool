from collections.abc import AsyncIterator

import pytest

from virtool.api.streaming import stream_storage_response
from virtool.storage.errors import StorageKeyNotFoundError


async def _missing_stream() -> AsyncIterator[bytes]:
    raise StorageKeyNotFoundError("missing")
    yield b""


async def test_stream_storage_response_propagates_storage_key_not_found():
    """A missing blob is a server-side bug and must propagate, not become a 404."""
    with pytest.raises(StorageKeyNotFoundError):
        await stream_storage_response(None, _missing_stream(), {})
