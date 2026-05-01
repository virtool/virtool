"""Unit tests for ``ObjectProvider``.

Drives the provider through its public surface, backed by an obstore in-memory
store via :meth:`ObjectProvider.for_memory`. End-to-end coverage against real
S3 / Azure backends lives in ``test_integration.py``; the protocol-level
behavioural contract is exercised in ``test_memory.py`` and the integration
suite. These tests focus on translation between obstore and the
``StorageBackend`` protocol that ``ObjectProvider`` is responsible for.
"""

import pytest

from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.object import ObjectProvider


@pytest.fixture
def provider() -> ObjectProvider:
    return ObjectProvider.for_memory()


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


class TestErrorTranslation:
    async def test_read_missing_key_raises_storage_error(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("does/not/exist"))

    async def test_delete_missing_key_is_idempotent(self, provider):
        await provider.delete("does/not/exist")


class TestRoundtrip:
    async def test_write_then_read(self, provider):
        await provider.write("samples/abc/reads.fq.gz", _async_iter(b"hello"))

        assert (
            await _collect_bytes(provider.read("samples/abc/reads.fq.gz")) == b"hello"
        )

    async def test_write_returns_byte_count(self, provider):
        size = await provider.write("uploads/file.txt", _async_iter(b"x" * 5000))

        assert size == 5000

    async def test_overwrite(self, provider):
        await provider.write("key", _async_iter(b"first"))
        await provider.write("key", _async_iter(b"second"))

        assert await _collect_bytes(provider.read("key")) == b"second"

    async def test_delete_then_read_raises(self, provider):
        await provider.write("doomed", _async_iter(b"data"))
        await provider.delete("doomed")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("doomed"))
