"""Tests for the add-sample-id-to-sample-files (phase 1+2) migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

PREVIOUS_REVISION = "1f4e528c2149"
REVISION = "c980043c0c89"


async def _insert_legacy_sample(ctx: MigrationContext, legacy_id: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO legacy_samples (
                    legacy_id, name, host, isolate, locale, notes, library_type,
                    format, created_at, paired, ready, hold, is_legacy, all_read,
                    all_write, group_read, group_write
                )
                VALUES (
                    :legacy_id, :legacy_id, '', '', '', '', 'normal',
                    'fastq', :now, false, true, false, false, false,
                    false, false, false
                )
                RETURNING id
            """),
            {"legacy_id": legacy_id, "now": arrow.utcnow().naive},
        )
        sample_id = result.scalar_one()
        await session.commit()

    return sample_id


async def _insert_artifact(ctx: MigrationContext, sample: str, name: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO sample_artifacts (sample, name, name_on_disk, type)
                VALUES (:sample, :name, :name, 'fasta')
                RETURNING id
            """),
            {"sample": sample, "name": name},
        )
        artifact_id = result.scalar_one()
        await session.commit()

    return artifact_id


async def _insert_reads(ctx: MigrationContext, sample: str, name: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO sample_reads (sample, name, name_on_disk)
                VALUES (:sample, :name, :name)
                RETURNING id
            """),
            {"sample": sample, "name": name},
        )
        reads_id = result.scalar_one()
        await session.commit()

    return reads_id


async def _fetch_sample_id(
    ctx: MigrationContext,
    table: str,
    row_id: int,
) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text(f"SELECT sample_id FROM {table} WHERE id = :id"),  # noqa: S608
            {"id": row_id},
        )
        return result.scalar_one()


@pytest.fixture
async def _at_previous_revision(apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic, PREVIOUS_REVISION)


class TestBackfill:
    async def test_artifact_sample_id_resolved_from_legacy_id(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        sample_id = await _insert_legacy_sample(ctx, "mapped_sample")
        artifact_id = await _insert_artifact(ctx, "mapped_sample", "reference.fa.gz")

        await asyncio.to_thread(apply_alembic, REVISION)

        assert await _fetch_sample_id(ctx, "sample_artifacts", artifact_id) == sample_id

    async def test_reads_sample_id_resolved_from_legacy_id(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        sample_id = await _insert_legacy_sample(ctx, "mapped_sample")
        reads_id = await _insert_reads(ctx, "mapped_sample", "reads_1.fq.gz")

        await asyncio.to_thread(apply_alembic, REVISION)

        assert await _fetch_sample_id(ctx, "sample_reads", reads_id) == sample_id

    async def test_unmapped_row_stays_null(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """A file row whose ``sample`` has no matching ``legacy_samples`` row keeps
        ``sample_id`` NULL rather than raising; the column is nullable during the
        transition.
        """
        artifact_id = await _insert_artifact(ctx, "orphan_sample", "reference.fa.gz")
        reads_id = await _insert_reads(ctx, "orphan_sample", "reads_1.fq.gz")

        await asyncio.to_thread(apply_alembic, REVISION)

        assert await _fetch_sample_id(ctx, "sample_artifacts", artifact_id) is None
        assert await _fetch_sample_id(ctx, "sample_reads", reads_id) is None
