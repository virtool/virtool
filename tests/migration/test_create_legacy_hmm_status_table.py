"""Tests for the create-legacy-hmm-status-table migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

REVISION = "d12be6ff40c1"


class TestCreateLegacyHMMStatusTable:
    async def test_creates_empty_table(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (await session.execute(text("SELECT * FROM legacy_hmm_status")))
                .mappings()
                .all()
            )

        assert rows == []

    async def test_accepts_singleton_row(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text(
                    """
                    INSERT INTO legacy_hmm_status (id, errors, updates)
                    VALUES (1, '[]'::jsonb, '[]'::jsonb)
                    """,
                ),
            )
            await session.commit()

            rows = (
                (await session.execute(text("SELECT id FROM legacy_hmm_status")))
                .mappings()
                .all()
            )

        assert [dict(row) for row in rows] == [{"id": 1}]

    async def test_rejects_non_singleton_id(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            with pytest.raises(IntegrityError):
                await session.execute(
                    text(
                        """
                        INSERT INTO legacy_hmm_status (id, errors, updates)
                        VALUES (2, '[]'::jsonb, '[]'::jsonb)
                        """,
                    ),
                )
