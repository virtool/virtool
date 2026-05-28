from collections.abc import AsyncIterator

import pytest

from virtool.api.errors import APINotFound
from virtool.api.streaming import stream_storage_response
from virtool.storage.errors import StorageKeyNotFoundError


async def _missing_stream() -> AsyncIterator[bytes]:
    raise StorageKeyNotFoundError("missing")
    yield b""


async def test_stream_storage_response_uses_default_not_found_message():
    with pytest.raises(APINotFound) as err:
        await stream_storage_response(None, _missing_stream(), {})

    assert err.value.message == "Not found"


async def test_stream_storage_response_uses_custom_not_found_message():
    with pytest.raises(APINotFound) as err:
        await stream_storage_response(None, _missing_stream(), {}, "File not found")

    assert err.value.message == "File not found"
