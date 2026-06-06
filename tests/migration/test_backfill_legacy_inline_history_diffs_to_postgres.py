"""Tests for the backfill legacy inline history diffs to postgres migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_an1no64kah8t_backfill_legacy_inline_history_diffs_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def apply_table(ctx: MigrationContext, apply_alembic: Callable) -> None:
    """Create the ``history_diffs`` table the backfill writes into."""
    await asyncio.to_thread(apply_alembic, required_alembic_revision)


def make_history_document(change_id: str, diff: object) -> dict:
    """Create a MongoDB history document for testing."""
    return {
        "_id": change_id,
        "created_at": "2026-06-05T00:00:00",
        "description": "Edited Foobar virus",
        "diff": diff,
        "index": {"id": "unbuilt", "version": "unbuilt"},
        "method_name": "edit",
        "otu": {"id": "otu_1", "name": "Foobar virus", "version": 3},
        "reference": {"id": "ref_1"},
        "user": {"id": "user_1"},
    }


async def fetch_diff(ctx: MigrationContext, change_id: str) -> object:
    """Return the ``history_diffs`` diff for ``change_id``, or raise if absent."""
    async with AsyncSession(ctx.pg) as session:
        return (
            await session.execute(
                text("SELECT diff FROM history_diffs WHERE change_id = :change_id"),
                {"change_id": change_id},
            )
        ).scalar_one()


async def fetch_mongo_diff(ctx: MigrationContext, change_id: str) -> object:
    document = await ctx.mongo.history.find_one({"_id": change_id})
    return document["diff"]


@pytest.mark.usefixtures("apply_table")
class TestUpgrade:
    async def test_edit_diff(self, ctx: MigrationContext):
        """A list-shaped edit diff is copied into Postgres and the doc is flipped."""
        diff = [["change", "name", ["Old name", "Foobar virus"]]]
        await ctx.mongo.history.insert_one(make_history_document("otu_1.3", diff))

        await upgrade(ctx)

        assert await fetch_diff(ctx, "otu_1.3") == diff
        assert await fetch_mongo_diff(ctx, "otu_1.3") == "postgres"

    async def test_create_diff(self, ctx: MigrationContext):
        """A dict-shaped create diff (full OTU) is copied verbatim."""
        diff = {"_id": "otu_1", "name": "Foobar virus", "version": 0, "isolates": []}
        document = make_history_document("otu_1.0", diff)
        document["method_name"] = "create"
        await ctx.mongo.history.insert_one(document)

        await upgrade(ctx)

        assert await fetch_diff(ctx, "otu_1.0") == diff
        assert await fetch_mongo_diff(ctx, "otu_1.0") == "postgres"

    async def test_backfills_every_inline_document(self, ctx: MigrationContext):
        """Every inline document is copied and flipped to the sentinel."""
        await ctx.mongo.history.insert_many(
            [
                make_history_document(f"otu_1.{version}", [["change", "v", version]])
                for version in range(5)
            ],
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (
                    await session.execute(
                        text("SELECT change_id FROM history_diffs ORDER BY change_id"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == [f"otu_1.{version}" for version in range(5)]

    async def test_already_postgres_is_untouched(self, ctx: MigrationContext):
        """Documents already flipped to the sentinel are left alone."""
        await ctx.mongo.history.insert_one(
            make_history_document("otu_1.3", "postgres"),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM history_diffs"))
            ).scalar_one()

        assert count == 0
        assert await fetch_mongo_diff(ctx, "otu_1.3") == "postgres"

    async def test_unrecoverable_diff_is_skipped_and_logged(
        self,
        ctx: MigrationContext,
    ):
        """A non-JSON diff (e.g. filesystem sentinel) is logged and skipped, not fatal."""
        await ctx.mongo.history.insert_one(make_history_document("otu_1.3", "file"))

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM history_diffs"))
            ).scalar_one()

        assert count == 0
        assert await fetch_mongo_diff(ctx, "otu_1.3") == "file"

    async def test_idempotent_rerun(self, ctx: MigrationContext):
        """Re-running inserts no duplicates and migrates documents added in between."""
        await ctx.mongo.history.insert_one(
            make_history_document("otu_1.1", [["change", "v", 1]]),
        )

        await upgrade(ctx)

        await ctx.mongo.history.insert_one(
            make_history_document("otu_1.2", [["change", "v", 2]]),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (
                    await session.execute(
                        text("SELECT change_id FROM history_diffs ORDER BY change_id"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == ["otu_1.1", "otu_1.2"]

    async def test_resumes_after_partial_run(self, ctx: MigrationContext):
        """A row written but not yet flipped is flipped on the next run without error."""
        diff = [["change", "name", ["Old name", "Foobar virus"]]]
        await ctx.mongo.history.insert_one(make_history_document("otu_1.3", diff))

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text(
                    "INSERT INTO history_diffs (change_id, diff) "
                    "VALUES ('otu_1.3', '[]'::jsonb)",
                ),
            )
            await session.commit()

        await upgrade(ctx)

        assert await fetch_diff(ctx, "otu_1.3") == []
        assert await fetch_mongo_diff(ctx, "otu_1.3") == "postgres"

    async def test_empty_collection_is_noop(self, ctx: MigrationContext):
        """An empty collection leaves the table empty."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM history_diffs"))
            ).scalar_one()

        assert count == 0
