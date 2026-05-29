"""Tests for the create-settings-table migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext

REVISION = "d16de6e24788"


class TestCreateSettingsTable:
    async def test_seeds_default_singleton_row(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (await session.execute(text("SELECT * FROM settings"))).mappings().all()
            )

        assert len(rows) == 1
        assert dict(rows[0]) == {
            "id": 1,
            "default_source_types": ["isolate", "strain"],
            "enable_api": False,
            "enable_sentry": True,
            "minimum_password_length": 8,
            "sample_all_read": True,
            "sample_all_write": False,
            "sample_group": "none",
            "sample_group_read": True,
            "sample_group_write": False,
        }

    async def test_rejects_second_row(
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
                        INSERT INTO settings (
                            id, default_source_types, enable_api, enable_sentry,
                            minimum_password_length, sample_all_read, sample_all_write,
                            sample_group, sample_group_read, sample_group_write
                        )
                        VALUES (
                            2, '[]'::jsonb, false, true, 8, true, false,
                            'none', true, false
                        )
                        """,
                    ),
                )

    async def test_rejects_unknown_sample_group(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            with pytest.raises(IntegrityError):
                await session.execute(
                    text("UPDATE settings SET sample_group = 'invalid' WHERE id = 1"),
                )
