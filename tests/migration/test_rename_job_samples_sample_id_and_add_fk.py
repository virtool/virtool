"""Tests for the rename-job_samples-sample_id-and-add-fk (phase 1+2) migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

PREVIOUS_REVISION = "91b32f49a8b2"
REVISION = "9f47a12a8ef6"


async def _insert_user(ctx: MigrationContext) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO users (
                    handle, active, email, force_reset, invalidate_sessions,
                    last_password_change, password, settings
                )
                VALUES (
                    'testuser', true, '', false, false,
                    :now, :password, '{}'::jsonb
                )
                RETURNING id
            """),
            {"now": arrow.utcnow().naive, "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()

    return user_id


async def _insert_job(ctx: MigrationContext, user_id: int) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO jobs (workflow, state, user_id, created_at)
                VALUES ('create_sample', 'pending', :user_id, :now)
                RETURNING id
            """),
            {"user_id": user_id, "now": arrow.utcnow().naive},
        )
        job_id = result.scalar_one()
        await session.commit()

    return job_id


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


async def _insert_job_sample(ctx: MigrationContext, job_id: int, sample: str) -> None:
    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            text("""
                INSERT INTO job_samples (job_id, sample_id)
                VALUES (:job_id, :sample)
            """),
            {"job_id": job_id, "sample": sample},
        )
        await session.commit()


async def _fetch_sample_id(ctx: MigrationContext, job_id: int) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("SELECT sample_id FROM job_samples WHERE job_id = :job_id"),
            {"job_id": job_id},
        )
        return result.scalar_one()


@pytest.fixture
async def _at_previous_revision(apply_alembic: Callable) -> None:
    await asyncio.to_thread(apply_alembic, PREVIOUS_REVISION)


class TestBackfill:
    async def test_sample_id_resolved_from_legacy_id(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        user_id = await _insert_user(ctx)
        job_id = await _insert_job(ctx, user_id)
        sample_id = await _insert_legacy_sample(ctx, "mapped_sample")
        await _insert_job_sample(ctx, job_id, "mapped_sample")

        await asyncio.to_thread(apply_alembic, REVISION)

        assert await _fetch_sample_id(ctx, job_id) == sample_id

    async def test_unmapped_row_stays_null(
        self,
        ctx: MigrationContext,
        _at_previous_revision: None,
        apply_alembic: Callable,
    ):
        """A ``job_samples`` row whose ``sample`` has no matching ``legacy_samples``
        row keeps ``sample_id`` NULL rather than raising; a ``create_sample`` job
        can outlive a deleted sample, and the column is nullable during the
        transition.
        """
        user_id = await _insert_user(ctx)
        job_id = await _insert_job(ctx, user_id)
        await _insert_job_sample(ctx, job_id, "orphan_sample")

        await asyncio.to_thread(apply_alembic, REVISION)

        assert await _fetch_sample_id(ctx, job_id) is None
