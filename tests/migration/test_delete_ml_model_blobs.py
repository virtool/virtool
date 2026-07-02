"""Tests for the delete-ml-model-blobs migration."""

from collections.abc import AsyncIterator

from assets.revisions.rev_t15v503oih88_delete_ml_model_blobs import upgrade
from virtool.migration.ctx import MigrationContext
from virtool.storage.protocol import StorageBackend


async def _one_chunk(content: bytes) -> AsyncIterator[bytes]:
    yield content


async def _exists(storage: StorageBackend, key: str) -> bool:
    async for _ in storage.list(key):
        return True
    return False


class TestUpgrade:
    async def test_deletes_ml_blobs_and_retains_others(
        self,
        ctx: MigrationContext,
        memory_storage: StorageBackend,
    ):
        ml_keys = (
            "ml/1/model.tar.gz",
            "ml/2/model.tar.gz",
        )
        retained_keys = (
            "samples/sample_1/analysis/analysis_1/results.json",
            "references/reference_1/otus.json",
        )

        for key in (*ml_keys, *retained_keys):
            await memory_storage.write(key, _one_chunk(b"content"))

        await upgrade(ctx)

        for key in ml_keys:
            assert not await _exists(memory_storage, key)

        for key in retained_keys:
            assert await _exists(memory_storage, key)

    async def test_is_idempotent(
        self,
        ctx: MigrationContext,
        memory_storage: StorageBackend,
    ):
        await memory_storage.write("ml/1/model.tar.gz", _one_chunk(b"content"))

        await upgrade(ctx)
        await upgrade(ctx)

        assert not await _exists(memory_storage, "ml/1/model.tar.gz")
