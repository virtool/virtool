"""Tests for the copy settings to postgres migration."""

import asyncio
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_q928h2q03qmp_copy_settings_to_postgres import upgrade
from virtool.migration.ctx import MigrationContext

REVISION = "d16de6e24788"


async def fetch_settings(ctx: MigrationContext) -> dict:
    async with AsyncSession(ctx.pg) as session:
        row = (await session.execute(text("SELECT * FROM settings"))).mappings().one()

    return dict(row)


class TestUpgrade:
    async def test_backfills_from_mongo(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        await ctx.mongo.settings.insert_one(
            {
                "_id": "settings",
                "enable_api": True,
                "minimum_password_length": 16,
                "sample_group": "force_choice",
                "hmm_slug": "virtool/virtool-hmm",
                "sample_unique_names": True,
            },
        )

        await upgrade(ctx)

        settings = await fetch_settings(ctx)

        assert settings["enable_api"] is True
        assert settings["minimum_password_length"] == 16
        assert settings["sample_group"] == "force_choice"
        assert "hmm_slug" not in settings
        assert "sample_unique_names" not in settings

    async def test_no_mongo_document_is_noop(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        await upgrade(ctx)

        settings = await fetch_settings(ctx)

        assert settings["enable_api"] is False
        assert settings["minimum_password_length"] == 8

    async def test_skips_when_already_customized(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("UPDATE settings SET minimum_password_length = 20 WHERE id = 1"),
            )
            await session.commit()

        await ctx.mongo.settings.insert_one(
            {"_id": "settings", "minimum_password_length": 16},
        )

        await upgrade(ctx)

        settings = await fetch_settings(ctx)

        assert settings["minimum_password_length"] == 20
