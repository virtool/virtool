"""Tests for the drop-dormant-sample-cache-tables migration."""

import asyncio
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

DOWN_REVISION = "5cb4e85e013f"
REVISION = "7ea2f370163c"
CACHE_TABLES = ("sample_artifacts_cache", "sample_reads_cache")


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


class TestDropCacheTables:
    async def test_tables_are_dropped(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, DOWN_REVISION)

        async with AsyncSession(ctx.pg) as session:
            for table in CACHE_TABLES:
                assert await _table_exists(session, table)

        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            for table in CACHE_TABLES:
                assert not await _table_exists(session, table)

    async def test_idempotent_when_tables_absent(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """The migration runs cleanly when the tables were never created."""
        await asyncio.to_thread(apply_alembic, DOWN_REVISION)

        async with AsyncSession(ctx.pg) as session:
            for table in CACHE_TABLES:
                await session.execute(text(f"DROP TABLE IF EXISTS {table}"))
            await session.commit()

        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            for table in CACHE_TABLES:
                assert not await _table_exists(session, table)

    async def test_artifacttype_enum_is_preserved(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        """Dropping ``sample_artifacts_cache`` must not drop the shared enum.

        The ``artifacttype`` enum is still used by the live ``sample_artifacts``
        table.
        """
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            assert await _enum_exists(session, "artifacttype")
