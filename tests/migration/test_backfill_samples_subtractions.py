"""Tests for the backfill-samples-subtractions-to-integers migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_24ysb9cwjiv1_backfill_samples_subtractions_to_integers import (
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_subtractions(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic head and seed two subtractions with legacy ids."""
    await asyncio.to_thread(apply_alembic, "head")

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO subtractions (
                    legacy_id, name, nickname, created_at, deleted, ready
                )
                VALUES
                    ('arabidopsis_legacy', 'Arabidopsis', '', :now, false, true),
                    ('vitis_legacy', 'Vitis', '', :now, false, true)
                RETURNING id, legacy_id
            """),
            {"now": arrow.utcnow().naive},
        )
        subtraction_ids = {row.legacy_id: row.id for row in result}

        await session.commit()

    return subtraction_ids


class TestSamplesSubtractionsBackfill:
    async def test_legacy_strings_convert(
        self,
        ctx: MigrationContext,
        setup_subtractions: dict[str, int],
    ):
        await ctx.mongo.samples.insert_one(
            {
                "_id": "sample_both",
                "subtractions": ["arabidopsis_legacy", "vitis_legacy"],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_both"})
        assert doc["subtractions"] == [
            setup_subtractions["arabidopsis_legacy"],
            setup_subtractions["vitis_legacy"],
        ]
        assert all(isinstance(s, int) for s in doc["subtractions"])

    async def test_already_int_passthrough(
        self,
        ctx: MigrationContext,
        setup_subtractions: dict[str, int],
    ):
        pg_id = setup_subtractions["arabidopsis_legacy"]
        await ctx.mongo.samples.insert_one(
            {"_id": "sample_int", "subtractions": [pg_id]},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_int"})
        assert doc["subtractions"] == [pg_id]

    async def test_mixed_array_converts_strings_only(
        self,
        ctx: MigrationContext,
        setup_subtractions: dict[str, int],
    ):
        arabidopsis = setup_subtractions["arabidopsis_legacy"]
        await ctx.mongo.samples.insert_one(
            {"_id": "sample_mixed", "subtractions": [arabidopsis, "vitis_legacy"]},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_mixed"})
        assert doc["subtractions"] == [arabidopsis, setup_subtractions["vitis_legacy"]]

    async def test_empty_array_untouched(
        self,
        ctx: MigrationContext,
        setup_subtractions: dict[str, int],
    ):
        await ctx.mongo.samples.insert_one({"_id": "sample_empty", "subtractions": []})

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "sample_empty"})
        assert doc["subtractions"] == []

    @pytest.mark.usefixtures("setup_subtractions")
    async def test_unmapped_legacy_raises(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.samples.insert_one(
            {"_id": "sample_orphan", "subtractions": ["ghost_subtraction"]},
        )

        with pytest.raises(ValueError, match="ghost_subtraction"):
            await upgrade(ctx)
