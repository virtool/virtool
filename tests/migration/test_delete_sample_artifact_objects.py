"""Tests for the ``delete sample artifact objects`` migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_kjjrlsltgsml_delete_sample_artifact_objects import upgrade
from virtool.migration.ctx import MigrationContext
from virtool.storage.errors import StorageError, StorageKeyNotFoundError

ALEMBIC_REVISION = "0cbbc3b23245"


async def _write(ctx: MigrationContext, key: str) -> None:
    async def _chunks():
        yield b"payload"

    await ctx.storage.write(key, _chunks())


async def _insert_artifact(
    ctx: MigrationContext,
    name: str,
    storage_key: str | None,
) -> None:
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            text(
                """
                INSERT INTO sample_artifacts (sample, name, name_on_disk, type,
                                              storage_key)
                VALUES ('sample_with_artifacts', :name, :name, 'fastq', :storage_key)
                """,
            ),
            {"name": name, "storage_key": storage_key},
        )
        await session.commit()


async def _insert_reads(ctx: MigrationContext, storage_key: str) -> None:
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            text(
                """
                INSERT INTO sample_reads (sample, name, name_on_disk, storage_key)
                VALUES ('sample_with_artifacts', 'reads_1.fq.gz', 'reads_1.fq.gz',
                        :storage_key)
                """,
            ),
            {"storage_key": storage_key},
        )
        await session.commit()


class TestDeleteSampleArtifactObjects:
    async def test_objects_are_deleted(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """Every object named by a surviving artifact row is removed."""
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        key = "samples/sample_with_artifacts/fastqc.txt"

        await _insert_artifact(ctx, "fastqc.txt", key)
        await _write(ctx, key)

        await upgrade(ctx)

        with pytest.raises(StorageKeyNotFoundError):
            await ctx.storage.size(key)

    async def test_reads_object_is_kept(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """An artifact sharing a key with a reads file leaves that object alone.

        Both key formats are ``samples/{sample}/{filename}``, so an artifact named
        ``reads_1.fq.gz`` addresses the sample's live reads file.
        """
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        key = "samples/sample_with_artifacts/reads_1.fq.gz"

        await _insert_reads(ctx, key)
        await _insert_artifact(ctx, "reads_1.fq.gz", key)
        await _write(ctx, key)

        await upgrade(ctx)

        assert await ctx.storage.size(key) == len(b"payload")

    async def test_failed_delete_raises(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
        mocker,
    ):
        """A storage error fails the revision so the sweep can be retried.

        The rows naming these objects are the only record of them, and the next
        revision drops that record. A revision that recorded itself as applied
        here would leave the survivors unreachable.
        """
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        key = "samples/sample_with_artifacts/fastqc.txt"

        await _insert_artifact(ctx, "fastqc.txt", key)
        await _write(ctx, key)

        mocker.patch.object(
            ctx.storage,
            "delete",
            side_effect=StorageError("bucket unreachable"),
        )

        with pytest.raises(RuntimeError, match="sample artifact objects"):
            await upgrade(ctx)

    async def test_null_storage_key_is_skipped(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """A row that names no object does not stop the sweep."""
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        key = "samples/sample_with_artifacts/fastqc.txt"

        await _insert_artifact(ctx, "unwritten.txt", None)
        await _insert_artifact(ctx, "fastqc.txt", key)
        await _write(ctx, key)

        await upgrade(ctx)

        with pytest.raises(StorageKeyNotFoundError):
            await ctx.storage.size(key)
