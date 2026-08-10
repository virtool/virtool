"""Tests for the drop-dormant-sample-artifacts-table migration."""

import asyncio
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

DOWN_REVISION = "0cbbc3b23245"
REVISION = "b253add43d69"


async def _table_exists(session: AsyncSession, name: str) -> bool:
    return bool(
        (
            await session.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = :name",
                ),
                {"name": name},
            )
        ).scalar_one(),
    )


async def _enum_exists(session: AsyncSession, name: str) -> bool:
    return bool(
        (
            await session.execute(
                text("SELECT COUNT(*) FROM pg_type WHERE typname = :name"),
                {"name": name},
            )
        ).scalar_one(),
    )


class TestDropSampleArtifactsTable:
    async def test_table_and_enum_are_dropped(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """The last user of ``artifacttype`` goes, so the enum goes with it."""
        await asyncio.to_thread(apply_alembic, DOWN_REVISION)

        async with AsyncSession(ctx.pg) as session:
            assert await _table_exists(session, "sample_artifacts")
            assert await _enum_exists(session, "artifacttype")

        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            assert not await _table_exists(session, "sample_artifacts")
            assert not await _enum_exists(session, "artifacttype")

    async def test_sample_reads_is_untouched(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """Reads files share the ``samples/`` prefix and must survive the drop."""
        await asyncio.to_thread(apply_alembic, DOWN_REVISION)

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text(
                    """
                    INSERT INTO sample_reads (sample, name, name_on_disk, storage_key)
                    VALUES ('sample_with_reads', 'reads_1.fq.gz', 'reads_1.fq.gz',
                            'samples/sample_with_reads/reads_1.fq.gz')
                    """,
                ),
            )
            await session.commit()

        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            assert (
                await session.execute(text("SELECT COUNT(*) FROM sample_reads"))
            ).scalar_one() == 1
