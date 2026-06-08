"""Tests for the create-legacy-history-table migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext
from virtool.utils import timestamp

REVISION = "743a03e550e0"


async def insert_user(session: AsyncSession) -> int:
    result = await session.execute(
        text("""
            INSERT INTO users (
                handle, legacy_id, active, email, force_reset,
                invalidate_sessions, last_password_change, password, settings
            )
            VALUES (
                'testuser', 'legacy_user_123', true, '', false,
                false, :now, :password, '{}'::jsonb
            )
            RETURNING id
        """),
        {"now": timestamp(), "password": b"hashed_password"},
    )
    return result.scalar_one()


INSERT_HISTORY = text("""
    INSERT INTO legacy_history (
        legacy_id, created_at, description, method_name, user_id,
        otu_id, otu_name, otu_version, reference_id, index_id, index_version
    )
    VALUES (
        :legacy_id, :now, 'Created Foobar', 'create', :user_id,
        'otu_1', 'Foobar', '0', 'ref_1', 'unbuilt', 'unbuilt'
    )
""")


class TestCreateLegacyHistoryTable:
    async def test_creates_empty_table(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (await session.execute(text("SELECT * FROM legacy_history")))
                .mappings()
                .all()
            )

        assert rows == []

    async def test_accepts_row_with_valid_user(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            user_id = await insert_user(session)
            await session.execute(
                INSERT_HISTORY,
                {"legacy_id": "otu_1.0", "now": timestamp(), "user_id": user_id},
            )
            await session.commit()

            rows = (
                (
                    await session.execute(
                        text("SELECT legacy_id, user_id FROM legacy_history"),
                    )
                )
                .mappings()
                .all()
            )

        assert [dict(row) for row in rows] == [
            {"legacy_id": "otu_1.0", "user_id": user_id},
        ]

    async def test_rejects_duplicate_legacy_id(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            user_id = await insert_user(session)
            await session.execute(
                INSERT_HISTORY,
                {"legacy_id": "otu_1.0", "now": timestamp(), "user_id": user_id},
            )
            await session.commit()

            with pytest.raises(IntegrityError):
                await session.execute(
                    INSERT_HISTORY,
                    {"legacy_id": "otu_1.0", "now": timestamp(), "user_id": user_id},
                )

    async def test_rejects_unknown_user_id(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            with pytest.raises(IntegrityError):
                await session.execute(
                    INSERT_HISTORY,
                    {"legacy_id": "otu_1.0", "now": timestamp(), "user_id": 999},
                )
