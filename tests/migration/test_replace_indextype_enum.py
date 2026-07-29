"""Tests for replacing the index file type enum with constrained text."""

import asyncio
from collections.abc import Callable
from pathlib import Path

import alembic.command
import alembic.config
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

PREVIOUS_REVISION = "06d0b71c37c3"
REVISION = "af827765c1d5"


def _downgrade(revision: str) -> None:
    alembic.command.downgrade(
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
    )


async def test_replaces_indextype_with_constrained_text(
    apply_alembic: Callable,
    ctx: MigrationContext,
):
    await asyncio.to_thread(apply_alembic, PREVIOUS_REVISION)
    await asyncio.to_thread(apply_alembic, REVISION)

    async with AsyncSession(ctx.pg) as session:
        column = (
            await session.execute(
                text("""
                    SELECT data_type, udt_name
                    FROM information_schema.columns
                    WHERE table_name = 'index_files' AND column_name = 'type'
                """),
            )
        ).one()
        enum_type = await session.scalar(text("SELECT to_regtype('indextype')"))
        constraint = await session.scalar(
            text("""
                SELECT pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE conname = 'ck_index_files_type'
            """),
        )

    assert column == ("text", "text")
    assert enum_type is None
    assert constraint is not None
    assert all(value in constraint for value in ("json", "fasta", "bowtie2", "sqlite"))


async def test_rejects_unknown_index_file_type(
    apply_alembic: Callable,
    ctx: MigrationContext,
):
    await asyncio.to_thread(apply_alembic, PREVIOUS_REVISION)
    await asyncio.to_thread(apply_alembic, REVISION)

    with pytest.raises(IntegrityError, match="ck_index_files_type"):
        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                    INSERT INTO index_files (index, index_id, name, type, size)
                    VALUES ('missing', 1, 'invalid', 'invalid', 0)
                """),
            )
            await session.commit()


async def test_downgrade_recreates_indextype(
    apply_alembic: Callable,
    ctx: MigrationContext,
):
    await asyncio.to_thread(apply_alembic, REVISION)
    await asyncio.to_thread(_downgrade, PREVIOUS_REVISION)
    await ctx.pg.dispose()

    async with AsyncSession(ctx.pg) as session:
        column_type = await session.scalar(
            text("""
                SELECT udt_name
                FROM information_schema.columns
                WHERE table_name = 'index_files' AND column_name = 'type'
            """),
        )
        enum_values = (
            await session.scalars(
                text("SELECT unnest(enum_range(NULL::indextype))::text"),
            )
        ).all()

    assert column_type == "indextype"
    assert enum_values == ["json", "fasta", "bowtie2"]
