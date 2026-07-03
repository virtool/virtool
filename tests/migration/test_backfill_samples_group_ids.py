"""Tests for the backfill-samples-group-ids-to-integers migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_bfzcj3gxn2dd_backfill_samples_group_ids_to_integers import (
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_groups(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic head and seed two groups with legacy ids."""
    await asyncio.to_thread(apply_alembic, "head")

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO groups (legacy_id, name, permissions)
                VALUES
                    ('technicians_legacy', 'Technicians', '{}'),
                    ('managers_legacy', 'Managers', '{}')
                RETURNING id, legacy_id
            """),
        )
        group_ids = {row.legacy_id: row.id for row in result}

        await session.commit()

    return group_ids


class TestSamplesGroupIdsBackfill:
    async def test_legacy_string_converts(
        self,
        ctx: MigrationContext,
        setup_groups: dict[str, int],
    ):
        await ctx.mongo.samples.insert_one(
            {"_id": "sample_legacy", "group": "technicians_legacy"},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_legacy"})
        assert doc["group"] == setup_groups["technicians_legacy"]
        assert isinstance(doc["group"], int)

    async def test_none_sentinel_becomes_null(
        self,
        ctx: MigrationContext,
        setup_groups: dict[str, int],
    ):
        await ctx.mongo.samples.insert_one({"_id": "sample_sentinel", "group": "none"})

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_sentinel"})
        assert doc["group"] is None

    async def test_null_untouched(
        self,
        ctx: MigrationContext,
        setup_groups: dict[str, int],
    ):
        await ctx.mongo.samples.insert_one({"_id": "sample_null", "group": None})

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_null"})
        assert doc["group"] is None

    async def test_already_int_passthrough(
        self,
        ctx: MigrationContext,
        setup_groups: dict[str, int],
    ):
        pg_id = setup_groups["managers_legacy"]
        await ctx.mongo.samples.insert_one({"_id": "sample_int", "group": pg_id})

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_int"})
        assert doc["group"] == pg_id

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup_groups: dict[str, int],
    ):
        await ctx.mongo.samples.insert_one(
            {"_id": "sample_legacy", "group": "technicians_legacy"},
        )

        await upgrade(ctx)
        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_legacy"})
        assert doc["group"] == setup_groups["technicians_legacy"]

    @pytest.mark.usefixtures("setup_groups")
    async def test_unmapped_legacy_raises(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.samples.insert_one(
            {"_id": "sample_orphan", "group": "ghost_group"},
        )

        with pytest.raises(ValueError, match="ghost_group"):
            await upgrade(ctx)
