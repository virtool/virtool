"""Tests for the ``delete bowtie2 subtraction files`` migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_22klaq3y66sm_delete_bowtie2_subtraction_files import (
    BATCH_SIZE,
    upgrade,
)
from virtool.migration.ctx import MigrationContext
from virtool.storage.errors import StorageError, StorageKeyNotFoundError

ALEMBIC_REVISION = "b253add43d69"


async def _write(ctx: MigrationContext, key: str) -> None:
    async def _chunks():
        yield b"payload"

    await ctx.storage.write(key, _chunks())


async def _insert_subtraction(ctx: MigrationContext, name: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        subtraction_id = (
            await session.execute(
                text(
                    """
                    INSERT INTO subtractions (name, nickname, created_at, deleted,
                                              ready)
                    VALUES (:name, '', now(), false, true)
                    RETURNING id
                    """,
                ),
                {"name": name},
            )
        ).scalar_one()

        await session.commit()

    return subtraction_id


async def _insert_file(
    ctx: MigrationContext,
    subtraction_id: int,
    name: str,
    type_: str,
    storage_key: str | None,
) -> None:
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            text(
                """
                INSERT INTO subtraction_files (subtraction_id, name, type, size,
                                               storage_key)
                VALUES (:subtraction_id, :name, :type, 100, :storage_key)
                """,
            ),
            {
                "subtraction_id": subtraction_id,
                "name": name,
                "type": type_,
                "storage_key": storage_key,
            },
        )
        await session.commit()


async def _list_file_names(ctx: MigrationContext) -> list[str]:
    async with AsyncSession(ctx.pg) as session:
        return sorted(
            (
                await session.execute(
                    text("SELECT name FROM subtraction_files"),
                )
            ).scalars(),
        )


class TestDeleteBowtie2SubtractionFiles:
    async def test_bowtie2_files_are_deleted(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """Every bowtie2 object and row is removed."""
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        subtraction_id = await _insert_subtraction(ctx, "legacy")

        keys = []

        for name in (
            "subtraction.1.bt2",
            "subtraction.2.bt2",
            "subtraction.rev.1.bt2",
        ):
            key = f"subtractions/{subtraction_id}/{name}"
            keys.append(key)

            await _insert_file(ctx, subtraction_id, name, "bowtie2", key)
            await _write(ctx, key)

        await upgrade(ctx)

        for key in keys:
            with pytest.raises(StorageKeyNotFoundError):
                await ctx.storage.size(key)

        assert await _list_file_names(ctx) == []

    async def test_fasta_file_is_kept(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """The FASTA a subtraction is still read from survives the sweep."""
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        subtraction_id = await _insert_subtraction(ctx, "legacy")

        fasta_key = f"subtractions/{subtraction_id}/subtraction.fa.gz"
        bowtie2_key = f"subtractions/{subtraction_id}/subtraction.1.bt2"

        await _insert_file(
            ctx,
            subtraction_id,
            "subtraction.fa.gz",
            "fasta",
            fasta_key,
        )
        await _insert_file(
            ctx,
            subtraction_id,
            "subtraction.1.bt2",
            "bowtie2",
            bowtie2_key,
        )

        await _write(ctx, fasta_key)
        await _write(ctx, bowtie2_key)

        await upgrade(ctx)

        assert await ctx.storage.size(fasta_key) == len(b"payload")
        assert await _list_file_names(ctx) == ["subtraction.fa.gz"]

    async def test_sweep_spans_batches(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """A sweep larger than one batch deletes every object and row."""
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        subtraction_id = await _insert_subtraction(ctx, "legacy")

        keys = []

        for i in range(BATCH_SIZE + 10):
            name = f"subtraction.{i}.bt2"
            key = f"subtractions/{subtraction_id}/{name}"
            keys.append(key)

            await _insert_file(ctx, subtraction_id, name, "bowtie2", key)
            await _write(ctx, key)

        await upgrade(ctx)

        for key in keys:
            with pytest.raises(StorageKeyNotFoundError):
                await ctx.storage.size(key)

        assert await _list_file_names(ctx) == []

    async def test_null_storage_key_is_skipped(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """A bowtie2 row that names no object is dropped without stopping the sweep."""
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        subtraction_id = await _insert_subtraction(ctx, "legacy")

        key = f"subtractions/{subtraction_id}/subtraction.1.bt2"

        await _insert_file(ctx, subtraction_id, "subtraction.2.bt2", "bowtie2", None)
        await _insert_file(ctx, subtraction_id, "subtraction.1.bt2", "bowtie2", key)
        await _write(ctx, key)

        await upgrade(ctx)

        with pytest.raises(StorageKeyNotFoundError):
            await ctx.storage.size(key)

        assert await _list_file_names(ctx) == []

    async def test_failed_delete_raises(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
        mocker,
    ):
        """A storage error fails the revision and leaves the rows in place.

        The rows are the only record of these objects, so dropping them after a
        failed sweep would leave the survivors unreachable.
        """
        await asyncio.to_thread(apply_alembic, ALEMBIC_REVISION)

        subtraction_id = await _insert_subtraction(ctx, "legacy")

        key = f"subtractions/{subtraction_id}/subtraction.1.bt2"

        await _insert_file(ctx, subtraction_id, "subtraction.1.bt2", "bowtie2", key)
        await _write(ctx, key)

        mocker.patch.object(
            ctx.storage,
            "delete",
            side_effect=StorageError("bucket unreachable"),
        )

        with pytest.raises(RuntimeError, match="bowtie2 subtraction objects"):
            await upgrade(ctx)

        assert await _list_file_names(ctx) == ["subtraction.1.bt2"]
